const __ = require('config').universalPath
const user_ = __.require('controllers', 'user/lib/user')
const getItemsByUsers = require('./lib/get_items_by_users')
const sanitize = __.require('lib', 'sanitize/sanitize')
const responses_ = __.require('lib', 'responses')
const error_ = __.require('lib', 'error/error')

const sanitization = {
  limit: {},
  offset: {},
  range: {},
  'include-users': {
    generic: 'boolean',
    default: true
  },
  'strict-range': {
    generic: 'boolean',
    default: false
  }
}

module.exports = (req, res) => {
  const { _id: reqUserId } = req.user
  sanitize(req, res, sanitization)
  .then(params => user_.nearby(reqUserId, params.range, params.strictRange)
  .then(getItemsByUsers.bind(null, params))).then(responses_.Send(res))
  .catch(error_.Handler(req, res))
}
