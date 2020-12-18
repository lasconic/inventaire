const __ = require('config').universalPath
const _ = __.require('builders', 'utils')
const wdk = require('wikidata-sdk')
const { simplify } = wdk
const { getEntityId } = require('./entity_helpers')
const { activeI18nLangs } = require('../helpers')
const getEntityImagesFromClaims = __.require('controllers', 'entities/lib/get_entity_images_from_claims')
const { firstClaim } = __.require('controllers', 'entities/lib/entities')
const getEntityType = __.require('controllers', 'entities/lib/get_entity_type')
const { indexedEntitiesTypes } = __.require('controllers', 'search/lib/indexes')
const specialEntityImagesGetter = __.require('controllers', 'entities/lib/special_entity_images_getter')
const { getSingularTypes } = __.require('lib', 'wikidata/aliases')
const { getEntityPopularity } = __.require('controllers', 'entities/lib/popularity')
const indexedEntitiesTypesSet = new Set(getSingularTypes(indexedEntitiesTypes))

module.exports = async (entity, options = {}) => {
  entity._id = getEntityId(entity)
  delete entity.id

  const { claims, type } = entity

  entity.type = dropPlural(getType({ claims, type }))

  // Do not index entities for which no type was found, as they wouldn't be accepted as values
  // for the corresponding type. To include an entity that was illegitimately rejected,
  // fix either server/lib/wikidata/aliases.js or server/controllers/entities/lib/get_entity_type.js
  // See https://github.com/inventaire/inventaire/pull/294
  if (!indexedEntitiesTypesSet.has(entity.type)) return

  let needsSimplification = false
  const isWikidataEntity = wdk.isItemId(entity._id)

  if (isWikidataEntity) {
    // Only Wikidata entities imported from a dump need to be simplified
    // Wikidata entities with a URI come from the Inventaire API, and are thus already simplified
    needsSimplification = entity.uri == null
    entity.uri = 'wd:' + entity._id
  } else {
    entity.uri = 'inv:' + entity._id
  }

  // Take images from claims if no images object was set by add_entities_images,
  // that is, for every entity types but works and series
  if (!entity.images) {
    if (specialEntityImagesGetter[entity.type]) {
      entity.images = await specialEntityImagesGetter[entity.type](entity)
    } else {
      entity.images = {
        claims: getEntityImagesFromClaims(entity, needsSimplification)
      }
    }
  }

  // If passed an already formatted entity
  delete entity.image

  if (needsSimplification) {
    entity.labels = simplify.labels(entity.labels)
    entity.descriptions = simplify.descriptions(entity.descriptions)
    entity.aliases = simplify.aliases(entity.aliases)
  }

  if (isWikidataEntity) {
    // flattened terms are a single string to index every possible languages on a wikidata entity
    // and to avoid having more than 1000 keys in an entity, which is forbidded by elasticsearch
    entity.flattenedLabels = flattenTerms(entity.labels)
    entity.flattenedDescriptions = flattenTerms(entity.descriptions)
    entity.flattenedAliases = flattenTerms(entity.aliases)
  }

  entity.labels = removeUnusedLangs(entity.labels)
  if (isWikidataEntity) {
    entity.descriptions = removeUnusedLangs(entity.descriptions)
    entity.aliases = removeUnusedLangs(entity.aliases)
  }

  if (Object.keys(entity.labels).length === 0) setTermsFromClaims(entity)

  // Those don't need to be indexed
  delete entity.claims
  delete entity.sitelinks

  entity.popularity = await getEntityPopularity({
    uri: entity.uri,
    // Only use already cached values in quick mode, instead of the default dryAndCache,
    // as that would mean spamming Wikidata when reindexing all entities,
    // and would result in that process being extremely slow, and possibibly crash
    // as we aren't even waiting for the dryAndCache response to continue.
    // But, do not set dry=true when reindexing the rest of the time, as that would
    // in most cases mean never populating the popularity
    dry: options.quick
  })

  return entity
}

const getType = ({ claims, type }) => {
  if (type && type !== 'entity') return type

  let wdtP31
  if (claims.P31) {
    wdtP31 = simplify.propertyClaims(claims.P31, { entityPrefix: 'wd' })
  } else {
    wdtP31 = claims['wdt:P31']
  }
  return getEntityType(wdtP31)
}

const dropPlural = type => {
  if (type) {
    return type.replace(/s$/, '')
  }
}

const setTermsFromClaims = entity => {
  const title = firstClaim(entity, 'wdt:P1476')
  const subtitle = firstClaim(entity, 'wdt:P1680')
  if (title) {
    entity.labels = { fromclaims: title }
  }
  if (subtitle) {
    entity.descriptions = { fromclaims: subtitle }
  }
}

const flattenTerms = terms => {
  return _.uniq(Object.values(terms)).join(' ')
}

// Reject terms langs not used by inventaire-i18n, as entity object indexation shall be less than 1000 keys long
// See: https://discuss.elastic.co/t/limit-of-total-fields-1000-in-index-has-been-exceeded-particular-jsons/222627
const removeUnusedLangs = terms => _.pick(terms, activeI18nLangs)