import CONFIG from 'config'
import { resolvePublisher } from '#controllers/entities/lib/resolver/resolve_publisher'
import { hardCodedUsers } from '#db/couchdb/hard_coded_documents'
import { parseIsbn } from '#lib/isbn/parse'
import temporarilyMemoize from '#lib/temporarily_memoize'
import { logError } from '#lib/utils/logs'
import { getSeedsByIsbns } from './dataseed.js'

const { _id: seedUserId } = hardCodedUsers.seed

const { enabled: dataseedEnabled } = CONFIG.dataseed

const resolverParams = {
  create: true,
  update: true,
  strict: true,
  enrich: true,
  reqUserId: seedUserId,
}

let resolveUpdateAndCreate, getEntityByUri, getAuthoritiesAggregatedEntry
const importCircularDependencies = async () => {
  ;({ resolveUpdateAndCreate } = await import('#controllers/entities/lib/resolver/resolve_update_and_create'))
  ;({ getEntityByUri } = await import('#controllers/entities/lib/get_entity_by_uri'))
  ;({ getAuthoritiesAggregatedEntry } = await import('./get_authorities_aggregated_entry.js'))
}
setImmediate(importCircularDependencies)

const getResolvedEntry = async isbn => {
  try {
    const entry = await getAuthoritiesAggregatedEntry(isbn)
    if (entry) {
      const entity = await getEditionEntityFromEntry(entry)
      if (entity) return entity
    }
    if (dataseedEnabled) {
      const [ seed ] = await getSeedsByIsbns(isbn)
      if (seed?.title) {
        const dataseedEntry = await buildEntry(seed)
        const entity = await getEditionEntityFromEntry(dataseedEntry)
        if (entity) return entity
        return dataseedEntry
      }
    }
  } catch (err) {
    logError(err, 'get_resolved_entry error')
  }
  return { isbn, notFound: true }
}

export default temporarilyMemoize({
  fn: getResolvedEntry,
  ttlAfterFunctionCallReturned: 2000,
})

const getEditionEntityFromEntry = async entry => {
  const { resolvedEntries } = await resolveUpdateAndCreate({ entries: [ entry ], ...resolverParams })
  const [ resolvedEntry ] = resolvedEntries
  if (resolvedEntry) {
    const { uri } = resolvedEntry.edition
    if (uri) return getEntityByUri({ uri })
  }
}

const buildEntry = async seed => {
  const { title, authors, image, publisher, publicationDate, isbn } = seed
  const isbnData = parseIsbn(isbn)
  const lang = isbnData.groupLang || 'en'
  const entry = {
    edition: {
      isbn,
      claims: {
        'wdt:P1476': title,
      },
      image,
    },
    works: [
      {
        labels: { [lang]: title },
      },
    ],
    authors: authors.map(authorName => ({
      labels: { [lang]: authorName },
    })),
  }
  if (publicationDate) entry.edition.claims['wdt:P577'] = publicationDate
  if (publisher) {
    const publisherUri = await resolvePublisher(isbn, publisher)
    if (publisherUri) entry.edition.claims['wdt:P123'] = publisherUri
  }
  return entry
}
