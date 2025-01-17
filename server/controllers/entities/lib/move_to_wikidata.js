import { getEntityById } from '#controllers/entities/lib/entities'
import { error_ } from '#lib/error/error'
import createWdEntity from './create_wd_entity.js'
import mergeEntities from './merge_entities.js'
import { unprefixify } from './prefix.js'
import { cacheEntityRelations } from './temporarily_cache_relations.js'

export default async (user, invEntityUri) => {
  const { _id: reqUserId } = user

  const entityId = unprefixify(invEntityUri)

  const entity = await getEntityById(entityId).catch(rewrite404(invEntityUri))

  const { labels, claims } = entity
  const { uri: wdEntityUri } = await createWdEntity({ labels, claims, user, isAlreadyValidated: true })

  // Caching relations for some hours, as Wikidata Query Service can take some time to update,
  // at the very minimum some minutes, during which the data contributor might be confused
  // by the absence of the entity they just moved to Wikidata in lists generated with the help of the WQS
  await cacheEntityRelations(invEntityUri)

  await mergeEntities({
    userId: reqUserId,
    fromUri: invEntityUri,
    toUri: wdEntityUri,
    context: {
      action: 'move-to-wikidata',
    },
  })

  return { uri: wdEntityUri }
}

const rewrite404 = invEntityUri => err => {
  if (err.statusCode === 404) {
    throw error_.new('entity not found', 400, { invEntityUri })
  } else {
    throw err
  }
}
