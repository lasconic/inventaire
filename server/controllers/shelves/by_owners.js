const _ = require('builders/utils')
const shelves_ = require('controllers/shelves/lib/shelves')
const filterVisibleShelves = require('./lib/filter_visible_shelves')

const sanitization = {
  owners: {},
  limit: { optional: true },
  offset: { optional: true }
}

const controller = async params => {
  const shelves = await getShelvesByOwners(params)
  return { shelves }
}

const getShelvesByOwners = async params => {
  const { reqUserId } = params
  let { owners } = params
  owners = _.forceArray(owners)
  const shelves = await shelves_.byOwners(owners)
  const authorizedShelves = await filterVisibleShelves(shelves, reqUserId)
  return _.keyBy(authorizedShelves, '_id')
}

module.exports = { sanitization, controller }
