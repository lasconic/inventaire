import CONFIG from 'config'
import { makeUrl, getEntityUriFromActorName, getEntityActorName } from '#controllers/activitypub/lib/helpers'
import { getEntityByUri } from '#controllers/entities/lib/get_entity_by_uri'
import { isEntityUri, isUsername } from '#lib/boolean_validations'
import { ControllerWrapper } from '#lib/controller_wrapper'
import { error_ } from '#lib/error/error'
import { validateUser, validateShelf } from './lib/validations.js'

const origin = CONFIG.getPublicOrigin()
const publicHost = origin.split('://')[1]

const sanitization = {
  resource: {},
}

const controller = async ({ resource }) => {
  const name = getActorName(resource)
  if (isEntityUri(getEntityUriFromActorName(name))) {
    const entity = await getEntityByUri({ uri: getEntityUriFromActorName(name) })
    if (entity) return formatWebfinger(getEntityActorName(entity.uri))
  } else if (name.startsWith('shelf-')) {
    await validateShelf(name)
    return formatWebfinger(name)
  } else if (isUsername(name)) {
    const { user } = await validateUser(name)
    return formatWebfinger(user.stableUsername)
  }
  throw error_.notFound({ resource, name })
}

export default {
  get: ControllerWrapper({
    access: 'public',
    sanitization,
    controller,
  }),
}

const getActorName = resource => {
  const actorWithHost = resource.slice(5)
  return actorWithHost.split('@')[0]
}

const formatWebfinger = name => {
  const actorUrl = makeUrl({ params: { action: 'actor', name } })

  return {
    subject: `acct:${name}@${publicHost}`,
    aliases: [ actorUrl ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
    ],
  }
}
