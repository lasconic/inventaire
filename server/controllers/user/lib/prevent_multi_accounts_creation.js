// Preventing several accounts to be created at the same time, given that
// the creation process is considerably slowed when bcrypt is used to hash passwords

import CONFIG from 'config'
import { error_ } from '#lib/error/error'
import { normalizeString } from '#lib/utils/base'

const { useSlowPasswordHashFunction } = CONFIG

const lockTime = useSlowPasswordHashFunction ? 60000 : 500
const lockedUsernames = new Set()
const errMessage = 'an account is already in the process of being created with this username'

export default username => {
  const canonicalUsername = normalizeString(username.toLowerCase())
  if (lockedUsernames.has(canonicalUsername)) {
    throw error_.new(errMessage, 400, { username, canonicalUsername })
  } else {
    lockTemporarily(canonicalUsername)
  }
}

const lockTemporarily = canonicalUsername => {
  lockedUsernames.add(canonicalUsername)
  setTimeout(() => lockedUsernames.delete(canonicalUsername), lockTime)
}
