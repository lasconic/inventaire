import _ from '#builders/utils'
import 'should'
import { createUser } from '#fixtures/users'
import { customAuthReq } from '#tests/api/utils/request'
import { getRandomPosition } from '../fixtures/users.js'
import { waitForIndexation } from '../utils/search.js'

const positionUser1 = getRandomPosition()
const positionUser2 = [
  positionUser1[0] - 0.1,
  positionUser1[1] - 0.1,
]
const positionUser3 = [
  positionUser1[0] - 0.11,
  positionUser1[1] - 0.11,
]
const positionUser4 = [
  positionUser1[0] - 0.12,
  positionUser1[1] - 0.12,
]
const geolocatedUser1Promise = createUser({ position: positionUser1 })
const geolocatedUser2Promise = createUser({ position: positionUser2 })
const geolocatedUser3Promise = createUser({ position: positionUser3 })
const geolocatedUser4Promise = createUser({ position: positionUser4 })
const endpoint = '/api/users?action=nearby'

describe('users:nearby', () => {
  it('should get users nearby', async () => {
    const user1 = await geolocatedUser1Promise
    await waitForIndexation('users', user1._id)
    const { users } = await customAuthReq(geolocatedUser2Promise, 'get', endpoint)
    const usersIds = _.map(users, '_id')
    usersIds.includes(user1._id).should.be.true()
  })

  it('should accept a range', async () => {
    const user1 = await geolocatedUser1Promise
    await waitForIndexation('users', user1._id)
    const { users } = await customAuthReq(geolocatedUser2Promise, 'get', `${endpoint}&range=1`)
    const usersIds = _.map(users, '_id')
    usersIds.includes(user1._id).should.be.false()
  })

  it('should get users nearby sorted by distance', async () => {
    const user2 = await geolocatedUser2Promise
    const user3 = await geolocatedUser3Promise
    const user4 = await geolocatedUser4Promise
    await Promise.all([
      waitForIndexation('users', user2._id),
      waitForIndexation('users', user3._id),
      waitForIndexation('users', user4._id),
    ])
    const { users } = await customAuthReq(geolocatedUser1Promise, 'get', endpoint)
    const usersIds = _.map(users, '_id')
    usersIds.includes(user2._id).should.be.true()
    usersIds.includes(user3._id).should.be.true()
    usersIds.includes(user4._id).should.be.true()
    usersIds.indexOf(user2._id).should.be.below(usersIds.indexOf(user3._id))
    usersIds.indexOf(user3._id).should.be.below(usersIds.indexOf(user4._id))
  })
})
