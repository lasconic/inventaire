CONFIG = require 'config'
{ verbosity } = CONFIG
__ = CONFIG.universalPath
_ = __.require 'builders', 'utils'
{ oneMinute, halfAnHour} =  __.require 'lib', 'times'

analyticsCouchDB = __.require('couch', 'base')('analytics', 'reports')

module.exports = (analyticsLevelDB)->
  saveToCouch = ->
    stats =
      transfered: 0
      kept: 0
      dropped: 0
      refTime: Date.now()
    analyticsLevelDB.sub.createValueStream()
    .on 'data', transferReportToCouch.bind(null, stats)
    .on 'end', logStats.bind(null, stats)

  transferReportToCouch = (stats, doc)->
    _.types arguments, ['object', 'string']
    { refTime } = stats
    doc = JSON.parse(doc)
    if sessionIsOver(refTime, doc?.time?.last)
      putInCouch(doc)
      .then clearLevel.bind(null, stats, doc._id)
      .catch dropIfConflict.bind(null, stats, doc._id)
      .catch _.Error('report transfer err')
    else
      stats.kept++


  sessionIsOver = (refTime, lastTime)->
    if lastTime?
      # JSON conversions messes with the type
      lastTime = Number(lastTime)
      # arbitrary choosing 5 minutes
      # given session with last time older than 30 sec are finished
      return (lastTime + halfAnHour) < refTime
    else return false

  putInCouch = (doc)->
    _.type doc, 'object'
    doc.type = 'report'
    analyticsCouchDB.put(doc)

  clearLevel = (stats, docId, res)->
    _.types arguments, ['object', 'string', 'object']
    if verbosity > 1
      _.log docId, 'succesfully transfered to couch. deleting in level'
    stats.transfered++
    analyticsLevelDB.del docId

  dropIfConflict = (stats, docId, err)->
    # delete the doc in any case
    analyticsLevelDB.del docId
    if err.statusCode is 409
      _.warn 'report in conflict: dropping report update'
      stats.dropped++
    else
      throw err

  logStats = (stats)->
    if verbosity > 2
      cb = -> _.info(stats, "analytics transfered to Couchdb")
      setTimeout cb , oneMinute


  # let 20 seconds to the server to finish to start before transfering
  setTimeout saveToCouch, 20 * 1000
  # the transfering every half hour
  setInterval saveToCouch, halfAnHour

  return saveToCouch