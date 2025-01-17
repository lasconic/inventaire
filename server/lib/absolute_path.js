import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

const folders = {
  root: projectRoot.replace(/\/$/, ''),
  client: `${projectRoot}client`,
  server: `${projectRoot}server`,
  tests: `${projectRoot}tests`,
  lib: `${projectRoot}server/lib`,
  db: `${projectRoot}server/db`,
  i18nDist: `${projectRoot}inventaire-i18n/dist/server`,
  i18nSrc: `${projectRoot}inventaire-i18n/src`,
}

export function absolutePath (folderAlias, filePath) {
  const folder = folders[folderAlias]
  if (!folder) throw new Error(`folder not found: ${folderAlias}`)
  return `${folder}/${filePath}`
}

// Allow to be called from scripts as:
//   node server/lib/absolute_path.js folderAlias filePath
if (import.meta.url.includes(process.argv[1])) {
  const [ folderAlias, filePath ] = process.argv.slice(2)
  console.log(absolutePath(folderAlias, filePath))
}
