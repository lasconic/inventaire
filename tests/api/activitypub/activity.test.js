const CONFIG = require('config')
const debounceTime = CONFIG.activitiesDebounceTime
require('should')
const { createItem } = require('../fixtures/items')
const { createUser } = require('../fixtures/users')
const { publicReq, signedReq } = require('../utils/utils')
const { wait } = require('lib/promises')
const { makeUrl } = require('../utils/activitypub')
const requests_ = require('lib/requests')

describe('activity', () => {
  it('should get an activity', async () => {
    const user = await createUser({ fediversable: true })
    const { username } = user
    const actorUrl = makeUrl({ params: { action: 'actor', name: username } })
    const inboxUrl = makeUrl({ params: { action: 'inbox', name: username } })
    // Follow user
    const { remoteHost } = await signedReq({ object: actorUrl, url: inboxUrl })
    await createItem(user)
    await wait(debounceTime + 500)
    await publicReq('get', `/api/activitypub?action=outbox&name=${username}&offset=0`)
    const { inbox } = await requests_.get(`${remoteHost}/inbox_inspection?username=${username}`)
    const [ createActivity ] = inbox
    const activityUrl = createActivity.object.id
    const activityId = new URL(activityUrl).searchParams.get('id')
    const activity = await publicReq('get', `/api/activitypub?action=activity&id=${activityId}`)
    activity.id.should.equal(`${activityUrl}#create`)
    activity.type.should.equal('Create')
    activity.object.id.should.equal(activityUrl)
    activity.object.type.should.equal('Note')
    activity.object.content.should.be.a.String()
  })
})