import { getUserByEmail, getUserByUsername } from '#controllers/user/lib/user'
import { error_ } from '#lib/error/error'
import { success } from '#lib/utils/logs'
import User from '#models/user'
import isReservedWord from './is_reserved_word.js'

export async function checkUsernameAvailability (username, currentUsername) {
  // If a currentUsername is provided
  // return true if the new username is the same but with a different case
  // (used for username update)
  if (currentUsername) {
    if (username.toLowerCase() === currentUsername.toLowerCase()) return
  }

  if (!User.validations.username(username)) {
    throw error_.newInvalid('username', username)
  }

  if (isReservedWord(username)) {
    throw error_.new("reserved words can't be usernames", 400, username)
  }

  return getUserByUsername(username)
  .then(checkAvailability.bind(null, username, 'username'))
}

export async function checkEmailAvailability (email) {
  if (!User.validations.email(email)) {
    throw error_.newInvalid('email', email)
  }

  return getUserByEmail(email)
  .then(checkAvailability.bind(null, email, 'email'))
}

export const availability_ = {
  username: checkUsernameAvailability,
  email: checkEmailAvailability,
}

const checkAvailability = (value, label, docs) => {
  if (docs.length !== 0) {
    throw error_.new(`this ${label} is already used`, 400, value)
  }

  success(value, 'available')
  return value
}
