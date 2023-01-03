#!/usr/bin/env node
// Usage:
//   npm run backup-databases http://username:password@localhost:5984 prod

import { log, LogError, success } from '#lib/utils/logs'
import backupDatabase from './lib/backup_database.js'
import getDatabasesNames from './lib/get_databases_names.js'
import zipBackupFolder from './lib/zip_backup_folder.js'

const [ couchdbUrl, suffix ] = process.argv.slice(2)

const { username, password, hostname, port } = new URL(couchdbUrl)

const dbsNames = getDatabasesNames(suffix)
log(dbsNames, 'databases to backup')

const backup = async () => {
  await Promise.all(dbsNames.map(dbName => {
    return backupDatabase({ username, password, hostname, port, dbName })
  }))
  success('done doing backup')
  await zipBackupFolder()
  success('cleaned')
}

backup()
.catch(LogError('databases backup err'))
