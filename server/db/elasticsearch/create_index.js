import CONFIG from 'config'
import mappings from '#db/elasticsearch/mappings/mappings'
import settings from '#db/elasticsearch/settings/settings'
import { requests_ } from '#lib/requests'
import { warn, success } from '#lib/utils/logs'

const { origin } = CONFIG.elasticsearch

export default async index => {
  const url = `${origin}/${index}`
  const indexBaseName = index.split('-')[0]
  const indexMappings = mappings[indexBaseName]
  const body = { settings }
  if (indexMappings) body.mappings = indexMappings
  try {
    const res = await requests_.put(url, { body })
    success(res, `elasticsearch index created: ${url}`)
  } catch (err) {
    ignoreAlreadyExisting(url, err)
  }
}

const ignoreAlreadyExisting = (url, err) => {
  if (err.body && err.body.error.type === 'resource_already_exists_exception') {
    return warn(url, 'database already exist')
  } else {
    throw err
  }
}
