import { stat, unlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import mvWithCallback from 'mv'

export const mv = promisify(mvWithCallback)
// Using 'unlink' instead of 'rm' until the minimal node version gets above v14.14.0
// See https://nodejs.org/api/fs.html#fs_fspromises_rm_path_options
export const rm = unlink
export const getContentLength = src => stat(src).then(({ size }) => size)
