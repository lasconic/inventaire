import CONFIG from 'config'
import 'should'
import { getEntityActorName, makeUrl } from '#controllers/activitypub/lib/helpers'
import { wait } from '#lib/promises'
import { requests_ } from '#lib/requests'
import { rethrowShouldNotBeCalledErrors } from '#tests/unit/utils'
import { createHuman, createWork, addAuthor } from '../fixtures/entities.js'
import { createItem } from '../fixtures/items.js'
import { createShelf } from '../fixtures/shelves.js'
import { randomWords } from '../fixtures/text.js'
import { createUser } from '../fixtures/users.js'
import { signedReq } from '../utils/activitypub.js'
import { addItemsToShelf, getActorName } from '../utils/shelves.js'

const debounceTime = CONFIG.activitypub.activitiesDebounceTime + 200

describe('followers activity delivery', () => {
  describe('users followers', () => {
    it('should post an activity to inbox', async () => {
      const user = await createUser({ fediversable: true })
      const { username } = user
      const followedActorUrl = makeUrl({ params: { action: 'actor', name: username } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
      const { remoteHost, remoteUserId, remoteUsername } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      const details = randomWords(4)
      const item = await createItem(user, { details })
      await wait(debounceTime)
      const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${remoteUsername}`)
      const createActivity = inbox.find(a => a.type === 'Create')
      createActivity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      createActivity.object.content.should.containEql(item._id)
      createActivity.object.content.should.containEql(details)
      createActivity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })

  describe('entities followers', () => {
    it('should post an activity to inbox', async () => {
      const { uri: authorUri } = await createHuman()
      const { uri: workUri, _id: workId } = await createWork()
      const followedActorUrl = makeUrl({ params: { action: 'actor', name: getEntityActorName(authorUri) } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name: getEntityActorName(authorUri) } })
      const { remoteHost, remoteUserId, remoteUsername } = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      await addAuthor(workUri, authorUri)
      await wait(500)
      const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${remoteUsername}`)
      const createActivity = inbox.find(a => a.type === 'Create')
      createActivity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      createActivity.type.should.equal('Create')
      createActivity.object.type.should.equal('Note')
      createActivity.object.content.should.startWith('<p>')
      new URL(createActivity.object.id).searchParams.get('id').should.containEql(workId)
      createActivity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })

  describe('shelves followers', () => {
    it('should reject if owner is not fediversable', async () => {
      try {
        const user = await createUser({ fediversable: false })
        const { shelf } = await createShelf(user)
        const name = getActorName(shelf)

        const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
        const inboxUrl = makeUrl({ params: { action: 'inbox', name } })
        await signedReq({
          url: inboxUrl,
          object: followedActorUrl,
          type: 'Follow',
        })
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
      }
    })

    it('should reject if shelf is not public', async () => {
      try {
        const user = await createUser({ fediversable: true })
        const { shelf } = await createShelf(user, { visibility: [ 'friends' ] })
        const name = getActorName(shelf)
        const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
        const inboxUrl = makeUrl({ params: { action: 'inbox', name } })
        await signedReq({
          url: inboxUrl,
          object: followedActorUrl,
          type: 'Follow',
        })
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
      }
    })

    it('should post an activity to inbox shelves followers when adding an item to a shelf', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name } })
      const res = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      const { remoteHost, remoteUserId, remoteUsername } = res
      const { _id: itemId } = await createItem(user)
      await addItemsToShelf(user, shelf, [ itemId ])
      await wait(debounceTime)
      const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${remoteUsername}`)
      const activity = inbox.find(a => a.type === 'Create')
      activity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      activity.object.content.should.containEql(itemId)
      activity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })

    it('should post an activity to inbox shelves followers when creating an item in a shelf', async () => {
      const user = await createUser({ fediversable: true })
      const { shelf } = await createShelf(user)
      const name = getActorName(shelf)
      const followedActorUrl = makeUrl({ params: { action: 'actor', name } })
      const inboxUrl = makeUrl({ params: { action: 'inbox', name } })
      const res = await signedReq({
        url: inboxUrl,
        object: followedActorUrl,
        type: 'Follow',
      })
      const { remoteHost, remoteUserId, remoteUsername } = res
      const { _id: itemId } = await createItem(user, {
        shelves: [ shelf._id ],
      })
      await wait(debounceTime)
      const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${remoteUsername}`)
      const activity = inbox.find(a => a.type === 'Create')
      activity['@context'].should.containEql('https://www.w3.org/ns/activitystreams')
      activity.object.content.should.containEql(itemId)
      activity.to.should.deepEqual([ remoteUserId, 'Public' ])
    })
  })
})
