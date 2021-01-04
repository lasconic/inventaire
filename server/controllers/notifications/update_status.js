const __ = require('config').universalPath
const _ = __.require('builders', 'utils')
const error_ = __.require('lib', 'error/error')
const responses_ = __.require('lib', 'responses')
const { updateReadStatus } = require('./lib/notifications')

module.exports = (req, res) => {
  const reqUserId = req.user._id

  const { times } = req.body
  if (!_.isArray(times) || (times.length <= 0)) return _.ok(res)

  // TODO: consider using doc ids rather than timestamps
  updateReadStatus(reqUserId, times)
  .then(responses_.Ok(res))
  .catch(error_.Handler(req, res))
}
