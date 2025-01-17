import { findUserByUsernameOrEmail } from '#controllers/user/lib/user'
import { passwords as pw_ } from '#lib/crypto'
import { logError } from '#lib/utils/logs'
import loginAttempts from './login_attempts.js'

export default (username, password, done) => {
  if (loginAttempts.tooMany(username)) {
    done(null, false, { message: 'too_many_attempts' })
  }

  // addressing the case an email is provided instead of a username
  return findUserByUsernameOrEmail(username)
  .catch(invalidUsernameOrPassword.bind(null, done, username, 'findOneByUsername'))
  .then(returnIfValid.bind(null, done, password, username))
  .catch(finalError.bind(null, done))
}

const returnIfValid = (done, password, username, user) => {
  // need to check user existance to avoid
  // to call invalidUsernameOrPassword a second time
  // in case findOneByUsername returned an error
  if (!user) return

  return verifyUserPassword(user, password)
  .then(valid => {
    if (valid) done(null, user)
    else return invalidUsernameOrPassword(done, username, 'validity test')
  })
  .catch(invalidUsernameOrPassword.bind(null, done, username, 'verifyUserPassword'))
}

const invalidUsernameOrPassword = (done, username, label) => {
  loginAttempts.recordFail(username, label)
  done(null, false, { message: 'invalid_username_or_password' })
}

const verifyUserPassword = (user, password) => pw_.verify(user.password, password)

const finalError = (done, err) => {
  logError(err, 'username/password verify err')
  done(err)
}
