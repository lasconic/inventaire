import { log } from '#lib/utils/logs'
import { shellExec } from '#scripts/scripts_utils'
import { backupGeneralFolder, backupFolder, day } from './get_backup_folder_data.js'

export async function zipBackupFolder () {
  await shellExec('tar', [
    '-zcf',
    // Output
    `${backupFolder}.tar.gz`,
    // Change directory (cf http://stackoverflow.com/a/18681628/3324977 )
    '-C', backupGeneralFolder,
    // Input path from the changed directory
    day,
  ])
  await deleteFolder()
  log(`backup archived in ${backupGeneralFolder}`)
}

const deleteFolder = () => shellExec('rm', [ '-rf', backupFolder ])
