import CONFIG from 'config'
import couchInit from 'couch-init2'
import _ from '#builders/utils'
import { absolutePath } from '#lib/absolute_path'
import { log } from '#lib/utils/logs'
import { databases } from './databases.js'

const dbBaseUrl = CONFIG.db.getOrigin()
const formattedList = []

const setPreloadSuffix = preload => designDocsName => preload ? `${designDocsName}_preload` : designDocsName
const setJsExtension = filename => `${filename}.js`

const designDocFolder = absolutePath('db', 'couchdb/design_docs')

const init = async ({ preload }) => {
  try {
    // Adapt the list to couch-init2 needs
    for (const dbName in databases) {
      const designDocsNames = databases[dbName]
        .map(setPreloadSuffix(preload))
        .map(setJsExtension)

      formattedList.push({
        // Adding a suffix if needed
        name: CONFIG.db.name(dbName),
        designDocs: designDocsNames,
      })
    }

    const res = await couchInit(dbBaseUrl, formattedList, designDocFolder)
    if (_.objLength(res.operations) !== 0) log(res, 'couch init')
    // Work around circular dependencies
    setImmediate(afterInit)
  } catch (err) {
    if (err.message !== 'CouchDB name or password is incorrect') throw err

    const context = _.pick(CONFIG.db, 'protocol', 'hostname', 'port', 'username', 'password')
    // Avoid logging the password in plain text
    context.password = context.password.slice(0, 2) + _.obfuscate(context.password.slice(2, -1)) + context.password.at(-1)
    console.error(err.message, context)
    return process.exit(1)
  }
}

let _waitForCouchInit

export async function waitForCouchInit (options = {}) {
  // Return the same promises to all consumers
  _waitForCouchInit = _waitForCouchInit || init(options)
  return _waitForCouchInit
}

async function afterInit () {
  const { default: initHardCodedDocuments } = await import('./init_hard_coded_documents.js')
  await initHardCodedDocuments()
}
