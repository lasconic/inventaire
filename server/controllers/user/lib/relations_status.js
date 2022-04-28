const _ = require('builders/utils')
const { getUserGroupsIdsAndCoMembersIds } = require('controllers/groups/lib/groups')
const groups_ = require('controllers/groups/lib/groups')
const relations_ = require('controllers/relations/lib/queries')
const assert_ = require('lib/utils/assert_types')

module.exports = {
  getUserRelations: userId => {
    // just proxiing to let this module centralize
    // interactions with the social graph
    return relations_.getUserRelations(userId)
  },

  getRelationsStatuses: async (userId, usersIds) => {
    if (userId == null) return [ [], [], usersIds ]

    return getFriendsAndGroupCoMembers(userId)
    .then(spreadRelations(usersIds))
  },

  areFriendsOrGroupCoMembers: (userId, otherId) => {
    assert_.strings([ userId, otherId ])
    return getFriendsAndGroupCoMembers(userId)
    .then(([ friendsIds, coGroupMembersIds ]) => friendsIds.includes(otherId) || coGroupMembersIds.includes(otherId))
  },

  getNetworkIds: async userId => {
    if (userId == null) return []
    return getFriendsAndGroupCoMembers(userId)
    .then(_.flatten)
  },

  getNetworkUsersAndGroupsIds: async userId => {
    if (userId == null) return []
    const [ friendsIds, { groupsIds, coMembersIds } ] = await Promise.all([
      relations_.getUserFriends(userId),
      getUserGroupsIdsAndCoMembersIds(userId)
    ])
    const networkUsersIds = _.uniq(friendsIds.concat(coMembersIds))
    return { friendsIds, coMembersIds, networkUsersIds, groupsIds }
  }
}

const spreadRelations = usersIds => ([ friendsIds, coGroupMembersIds ]) => {
  const friends = []
  const coGroupMembers = []
  const publik = []

  for (const id of usersIds) {
    if (friendsIds.includes(id)) {
      friends.push(id)
    } else if (coGroupMembersIds.includes(id)) {
      coGroupMembers.push(id)
    } else {
      publik.push(id)
    }
  }

  return [ friends, coGroupMembers, publik ]
}

const getFriendsAndGroupCoMembers = userId => Promise.all([
  relations_.getUserFriends(userId),
  groups_.getUserGroupsCoMembers(userId)
])
