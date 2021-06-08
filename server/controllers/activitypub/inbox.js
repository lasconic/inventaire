const error_ = require('lib/error/error')
const { sanitize } = require('lib/sanitize/sanitize')
const { verifySignature } = require('controllers/activitypub/lib/security')
const { tap } = require('lib/promises')
const qs = require('querystring')
const user_ = require('controllers/user/lib/user')

const sanitization = {
  id: {
    // override couchUuid validation
    generic: 'string'
  },
  type: {
    allowlist: [ 'Follow' ]
  },
  actor: {},
  object: {}
}

module.exports = async (req, res) => {
  sanitize(req, res, sanitization)
  .then(tap(() => verifySignature(req)))
  .then(async params => {
    const { object } = params
    const { name: requestedObjectName } = qs.parse(object)
    const user = await user_.findOneByUsername(requestedObjectName)
    if (!user.fediversable) throw error_.notFound({ username: requestedObjectName })
    return {}
  })
  .then(res.json.bind(res))
  .catch(error_.Handler(req, res))
}
