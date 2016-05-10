__ = require('config').universalPath
_ = __.require 'builders', 'utils'
error_ = __.require 'lib', 'error/error'
entities_ = require './lib/entities'

module.exports = (req, res)->
  { id:entityId, property, 'old-value':oldVal, 'new-value': newVal } = req.body
  { _id:userId } = req.user

  _.log req.body, 'body'

  entities_.byId entityId
  .then _.Log('doc')
  .then entities_.updateClaim.bind(null, property, oldVal, newVal, userId)
  .then _.Ok(res)
  .catch error_.Handler(res)
