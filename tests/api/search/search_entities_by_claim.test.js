const _ = require('builders/utils')
require('should')
const { createHuman, createWorkWithAuthor } = require('../fixtures/entities')
const { shouldNotBeCalled } = require('../utils/utils')
const { search, waitForIndexation } = require('../utils/search')

describe('search:entities:by-claim', async () => {
  let workAuthor, workWithAuthor
  before(async () => {
    workAuthor = await createHuman()
    workWithAuthor = await createWorkWithAuthor(workAuthor)
    await waitForIndexation('entities', workWithAuthor._id)
  })

  it('should reject unknown properties', async () => {
    await search({ types: 'works', claim: 'wdt:P6=wd:Q535' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('unknown property')
    })
  })

  it('should reject invalid property values', async () => {
    await search({ types: 'works', claim: 'wdt:P123=456' })
    .then(shouldNotBeCalled)
    .catch(err => {
      err.statusCode.should.equal(400)
      err.body.status_verbose.should.equal('invalid property value')
    })
  })

  it('should find an entity by one of its relation claims', async () => {
    const results = await search({ types: 'works', claim: `wdt:P50=${workAuthor.uri}`, lang: 'en', filter: 'inv' })
    const foundIds = _.map(results, 'id')
    foundIds.should.containEql(workWithAuthor._id)
  })

  it('should accept OR conditions', async () => {
    const results = await search({ types: 'works', claim: `wdt:P50=wd:Q535|wdt:P50=${workAuthor.uri}`, lang: 'en', filter: 'inv' })
    const foundIds = _.map(results, 'id')
    foundIds.should.containEql(workWithAuthor._id)
  })

  it('should accept AND conditions', async () => {
    const results = await search({ types: 'works', claim: `wdt:P31=wd:Q47461344 wdt:P50=${workAuthor.uri}`, lang: 'en', filter: 'inv' })
    const foundIds = _.map(results, 'id')
    foundIds.should.containEql(workWithAuthor._id)
    const results2 = await search({ types: 'works', claim: `wdt:P31=wd:Q2831984 wdt:P50=${workAuthor.uri}`, lang: 'en', filter: 'inv' })
    const foundIds2 = _.map(results2, 'id')
    foundIds2.should.not.containEql(workWithAuthor._id)
  })

  it('should accept a combination of AND and OR conditions', async () => {
    const results = await search({ types: 'works', claim: `wdt:P31=wd:Q47461344 wdt:P50=wd:Q535|wdt:P50=${workAuthor.uri}`, lang: 'en', filter: 'inv' })
    const foundIds = _.map(results, 'id')
    foundIds.should.containEql(workWithAuthor._id)
  })
})
