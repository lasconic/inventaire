// Get and format Wikidata entities to match Inventaire entities:
// - simplify claims
// - add attributes: uri, originalLang
// - delete unnecessary attributes and ignore undesired claims
//   such as ISBNs defined on work entities

import { partition, map } from 'lodash-es'
import { simplifyAliases, simplifyDescriptions, simplifyLabels, simplifyPropertyClaims, simplifySitelinks } from 'wikibase-sdk'
import _ from '#builders/utils'
import { prefixifyWd, unprefixify } from '#controllers/entities/lib/prefix'
import { getWdEntity } from '#data/wikidata/get_entity'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { addWdEntityToIndexationQueue } from '#db/elasticsearch/wikidata_entities_indexation_queue'
import { cache_ } from '#lib/cache'
import { emit } from '#lib/radio'
import formatClaims from '#lib/wikidata/format_claims'
import getOriginalLang from '#lib/wikidata/get_original_lang'
import addImageData from './add_image_data.js'
import getEntityType from './get_entity_type.js'
import propagateRedirection from './propagate_redirection.js'

let reindexWdEntity
const importCircularDependencies = async () => {
  const { default: indexation } = await import('#db/elasticsearch/indexation')
  reindexWdEntity = indexation('wikidata')
}
setImmediate(importCircularDependencies)

const { _id: hookUserId } = hardCodedUsers.hook

export default async (ids, { refresh, dry }) => {
  const entities = await Promise.all(ids.map(wdId => getCachedEnrichedEntity({ wdId, refresh, dry })))
  let [ foundEntities, notFoundEntities ] = partition(entities, isNotMissing)
  if (dry) foundEntities = _.compact(foundEntities)
  return {
    entities: foundEntities,
    notFound: map(notFoundEntities, 'uri'),
  }
}

const isNotMissing = entity => entity && entity.type !== 'missing'

export async function getCachedEnrichedEntity ({ wdId, refresh, dry }) {
  const key = `wd:enriched:${wdId}`
  const fn = getEnrichedEntity.bind(null, wdId)
  return cache_.get({ key, fn, refresh, dry })
}

async function getEnrichedEntity (wdId) {
  let entity = await getWdEntity(wdId)
  entity = entity || { id: wdId, missing: true }
  const formattedEntity = await format(entity)
  addWdEntityToIndexationQueue(wdId)
  return formattedEntity
}

const format = async entity => {
  if (entity.missing != null) return formatEmpty('missing', entity)

  const { P31 } = entity.claims
  if (P31) {
    const simplifiedP31 = simplifyPropertyClaims(P31, simplifyClaimsOptions)
    entity.type = getEntityType(simplifiedP31)
  } else {
    // Make sure to override the type as Wikidata entities have a type with
    // another role in Wikibase, and we need this absence of known type to
    // filter-out entities that aren't in our focus (i.e. not works, author, etc)
    entity.type = null
  }

  entity.claims = omitUndesiredPropertiesPerType(entity.type, entity.claims)

  if (entity.type === 'meta') {
    return formatEmpty('meta', entity)
  } else {
    return formatValidEntity(entity)
  }
}

const simplifyClaimsOptions = { entityPrefix: 'wd' }

const formatValidEntity = async entity => {
  const { id: wdId } = entity
  entity.uri = `wd:${wdId}`
  entity.labels = simplifyLabels(entity.labels)
  entity.aliases = simplifyAliases(entity.aliases)
  entity.descriptions = simplifyDescriptions(entity.descriptions)
  entity.sitelinks = simplifySitelinks(entity.sitelinks, { keepBadges: true })
  entity.claims = formatClaims(entity.claims)
  entity.originalLang = getOriginalLang(entity.claims)

  await formatAndPropagateRedirection(entity)

  // Deleting unnecessary attributes
  delete entity.id
  delete entity.title
  delete entity.pageid
  delete entity.ns
  delete entity.modified

  // Not deleting entity.lastrevid as it is used
  // by server/db/elasticsearch/wikidata_entities_indexation_queue.js

  return addImageData(entity)
}

const formatAndPropagateRedirection = async entity => {
  if (entity.redirects != null) {
    const { from, to } = entity.redirects
    entity.redirects = {
      from: prefixifyWd(from),
      to: prefixifyWd(to),
    }

    // Take advantage of this request for a Wikidata entity to check
    // if there is a redirection we are not aware of, and propagate it:
    // if the redirected entity is used in Inventaire claims, redirect claims
    // to their new entity
    propagateRedirection(hookUserId, entity.redirects.from, entity.redirects.to)
    reindexWdEntity({ _id: unprefixify(entity.redirects.from), redirect: true })
    await emit('wikidata:entity:redirect', entity.redirects.from, entity.redirects.to)
  }
}

// Keeping just enough data to filter-out while not cluttering the cache
const formatEmpty = (type, entity) => ({
  id: entity.id,
  uri: `wd:${entity.id}`,
  type,
})

const omitUndesiredPropertiesPerType = (type, claims) => {
  const propertiesToOmit = undesiredPropertiesPerType[type]
  if (propertiesToOmit) {
    return _.omit(claims, propertiesToOmit)
  } else {
    return claims
  }
}

// Ignoring ISBN data set on work entities, as those
// should be the responsability of edition entities
const undesiredPropertiesPerType = {
  work: [ 'P212', 'P957' ],
}
