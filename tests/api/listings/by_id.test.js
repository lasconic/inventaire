import { createWork } from '#fixtures/entities'
import { createListing, createElement } from '#fixtures/listings'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils'
import { merge } from '../utils/entities.js'
import { publicReq, authReqB } from '../utils/utils.js'

const endpoint = '/api/lists?action=by-id'

describe('listings:by-id', () => {
  it('should reject without id', async () => {
    try {
      await publicReq('get', endpoint).then(shouldNotBeCalled)
    } catch (err) {
      rethrowShouldNotBeCalledErrors(err)
      err.body.status_verbose.should.equal('missing parameter in query: id')
      err.statusCode.should.equal(400)
    }
  })

  describe('visibility:overview', () => {
  // for detail visibility validations, see ./visibility.test.js
    it('should get a public listing', async () => {
      const { listing: reqListing } = await createListing()
      const { list: listing } = await publicReq('get', `${endpoint}&id=${reqListing._id}`)
      listing.should.be.an.Object()
    })

    it('should not return a private listing to an authentified user', async () => {
      const { listing } = await createListing(null, { visibility: [] })
      await authReqB('get', `${endpoint}&id=${listing._id}`)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(403)
      })
    })
  })

  describe('redirects hook', () => {
    it('should update element uri after merging entities', async () => {
      const work = await createWork()
      const { uri, listing } = await createElement({})
      await merge(uri, work.uri)
      const byIdEndpoint = '/api/lists?action=by-id'
      const { list } = await publicReq('get', `${byIdEndpoint}&id=${listing._id}`)
      list.elements[0].uri.should.equal(work.uri)
    })
  })
})
