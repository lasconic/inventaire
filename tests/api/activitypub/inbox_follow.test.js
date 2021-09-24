require('should')
const { createUser } = require('../fixtures/users')
const { signedReq, shouldNotBeCalled, rethrowShouldNotBeCalledErrors } = require('../utils/utils')
const { makeUrl, createRemoteActivityPubServerUser } = require('../utils/activitypub')
const { getFollowActivitiesByObject } = require('controllers/activitypub/lib/activities')
const { wait } = require('lib/promises')
const requests_ = require('lib/requests')
const { createHuman } = require('../fixtures/entities')

describe('activitypub:inbox:Follow', () => {
  describe('users', () => {
    it('should reject if user is not on the fediverse', async () => {
      try {
        const { username } = await createUser({ fediversable: false })
        const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
        const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
        await signedReq({
          object: actorUrl,
          url: inboxUrl
        })
        .then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        const parsedBody = JSON.parse(err.body)
        parsedBody.status_verbose.should.equal('user is not on the fediverse')
        parsedBody.status.should.equal(404)
      }
    })

    it('should create a Follow activity', async () => {
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
      const res = await signedReq({
        object: actorUrl,
        url: inboxUrl
      })
      res.statusCode.should.equal(200)
      const activities = await getFollowActivitiesByObject(username)
      activities.length.should.equal(1)
    })

    it('should not recreate a Follow activity if actor is already following someone', async () => {
      const emitterUser = await createRemoteActivityPubServerUser()
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
      const requestPromise = signedReq({
        emitterUser,
        object: actorUrl,
        url: inboxUrl
      })
      await requestPromise
      await wait(500)
      await requestPromise
      const activities = await getFollowActivitiesByObject(username)
      activities.length.should.equal(1)
    })

    it('should trigger an Accept activity', async () => {
      const emitterUser = await createRemoteActivityPubServerUser()
      const { username } = await createUser({ fediversable: true })
      const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
      const { remoteHost } = await signedReq({
        emitterUser,
        object: actorUrl,
        url: inboxUrl
      })
      const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${username}`)
      inbox.length.should.equal(1)
      const activity = inbox[0]
      activity['@context'].should.deepEqual([ 'https://www.w3.org/ns/activitystreams' ])
      activity.type.should.equal('Accept')
      activity.actor.should.equal(actorUrl)
      activity.object.should.startWith(remoteHost)
    })
  })

  describe('entities', () => {
    it('should reject if entity is not found', async () => {
      try {
        const uri = 'inv:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        const actorUrl = makeUrl({ params: { action: 'actor', name: uri } })
        const inboxUrl = makeUrl({ params: { action: 'inbox', name: uri } })
        await signedReq({
          object: actorUrl,
          url: inboxUrl
        })
        .then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        const parsedBody = JSON.parse(err.body)
        parsedBody.status.should.equal(404)
      }
    })

    it('should create a Follow activity', async () => {
      const { uri } = await createHuman()
      const actorUrl = makeUrl({ params: { action: 'actor', name: uri } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: uri } })
      const res = await signedReq({
        object: actorUrl,
        url: inboxUrl
      })
      res.statusCode.should.equal(200)
      const activities = await getFollowActivitiesByObject(uri)
      activities.length.should.equal(1)
    })
  })
})
