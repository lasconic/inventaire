import { keyBy, set, without } from 'lodash-es'
import { getNetworkIds } from '#controllers/user/lib/relations_status'
import dbFactory from '#db/couchdb/base'
import { defaultAvatar } from '#lib/assets'
import { firstDoc } from '#lib/couch'
import { error_ } from '#lib/error/error'
import searchUsersByDistanceFactory from '#lib/search_by_distance'
import searchUsersByPositionFactory from '#lib/search_by_position'
import { assert_ } from '#lib/utils/assert_types'
import { toLowerCase } from '#lib/utils/base'
import User from '#models/user'
import { omitPrivateData } from './authorized_user_data_pickers.js'
import { byEmail, byEmails, findOneByEmail } from './shared_user_handlers.js'

const db = await dbFactory('users')
const searchUsersByPosition = searchUsersByPositionFactory(db, 'users')
const searchUsersByDistance = searchUsersByDistanceFactory('users')

export const getUserById = db.get
export const getUsersByIds = db.byIds
export const getUserByEmail = byEmail.bind(null, db)
export const getUsersByEmails = byEmails.bind(null, db)
export const findUserByEmail = findOneByEmail.bind(null, db)

export const getUsersAuthorizedDataByEmails = (emails, reqUserId) => {
  assert_.array(emails)
  // Keeping the email is required to map the users returned
  // with the initial input
  return getUsersAuthorizedData(getUsersByEmails(emails), reqUserId, 'email')
}

export const getUserByUsername = username => db.viewByKey('byUsername', username.toLowerCase())
export const getUsersByUsernames = usernames => {
  return db.viewByKeys('byUsername', usernames.map(toLowerCase))
}

export const findUserByUsername = username => {
  return getUserByUsername(username)
  .then(firstDoc)
  .then(user => {
    if (user) return user
    else throw error_.notFound({ username })
  })
}

export const findUserByUsernameOrEmail = str => {
  if (User.validations.email(str)) {
    return findUserByEmail(str)
  } else {
    return findUserByUsername(str)
  }
}

export const getUsersAuthorizedDataByIds = async (ids, reqUserId) => {
  assert_.array(ids)
  if (ids.length === 0) return []
  return getUsersAuthorizedData(getUsersByIds(ids), reqUserId)
}

export const getUsersAuthorizedData = async (usersDocsPromise, reqUserId, extraAttribute) => {
  const [ usersDocs, networkIds ] = await Promise.all([
    usersDocsPromise,
    getNetworkIds(reqUserId),
  ])

  return usersDocs
  .map(omitPrivateData(reqUserId, networkIds, extraAttribute))
}

export const getUsersIndexedByIds = async (ids, reqUserId) => {
  const users = await getUsersAuthorizedDataByIds(ids, reqUserId)
  return keyBy(users, '_id')
}

export const getUsersIndexByUsernames = async (reqUserId, usernames) => {
  const users = await getUsersAuthorizedData(getUsersByUsernames(usernames), reqUserId)
  const usersByLowercasedUsername = {}
  const lowercasedUsernames = usernames.map(username => username.toLowerCase())
  for (const user of users) {
    if (lowercasedUsernames.includes(user.username.toLowerCase())) {
      usersByLowercasedUsername[user.username.toLowerCase()] = user
    } else if (lowercasedUsernames.includes(user.stableUsername.toLowerCase())) {
      usersByLowercasedUsername[user.stableUsername.toLowerCase()] = user
    }
  }
  return usersByLowercasedUsername
}

export const incrementUndeliveredMailCounter = async email => {
  const doc = await findUserByEmail(email)
  const { _id } = doc
  return db.update(_id, doc => {
    if (doc.undeliveredEmail == null) doc.undeliveredEmail = 0
    doc.undeliveredEmail += 1
    return doc
  })
}

export const addUserRole = (userId, role) => db.update(userId, User.addRole(role))

export const removeUserRole = (userId, role) => db.update(userId, User.removeRole(role))

export const setUserOauthTokens = (userId, provider, data) => {
  return db.update(userId, User.setOauthTokens(provider, data))
}

export const setUserStableUsername = async userData => {
  const { _id: userId, username, stableUsername } = userData
  if (stableUsername == null) {
    await db.update(userId, User.setStableUsername)
    userData.stableUsername = username
  }
  return userData
}

export const getUsersNearby = async (userId, meterRange, strict) => {
  const { position } = await getUserById(userId)
  if (position == null) {
    throw error_.new('user has no position set', 400, userId)
  }
  const usersIds = await findNearby(position, meterRange, null, strict)
  return without(usersIds, userId)
}

export const getUserByPosition = searchUsersByPosition

export const imageIsUsed = async imageHash => {
  assert_.string(imageHash)
  const { rows } = await db.view('users', 'byPicture', { key: imageHash })
  return rows.length > 0
}

// View model serialization for emails and rss feeds templates
export const serializeUserData = user => {
  user.picture = user.picture || defaultAvatar
  return user
}

const findNearby = async (latLng, meterRange, iterations = 0, strict = false) => {
  const usersIds = await searchUsersByDistance(latLng, meterRange)
  // Try to get the 10 closest (11 minus the main user)
  // If strict, don't increase the range, just return what was found;
  // else double the range
  // But stop after 10 iterations to avoid creating an infinit loop
  // if there are no users geolocated
  if (usersIds.length > 11 || strict || iterations > 10) {
    return usersIds
  } else {
    iterations += 1
    return findNearby(latLng, meterRange * 2, iterations)
  }
}

export async function stopAllUserEmailNotifications (email) {
  const user = await findUserByEmail(email)
  return db.update(user._id, doc => {
    return set(doc, 'settings.notifications.global', false)
  })
}
