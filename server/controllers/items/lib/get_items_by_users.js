const { addAssociatedData, Paginate } = require('./queries_commons')
const { filterPrivateAttributes } = require('controllers/items/lib/filter_private_attributes')
const getAuthorizedItems = require('controllers/items/lib/get_authorized_items')

module.exports = async (params, usersIds) => {
  // Allow to pass users ids either through the params object
  // or as an additional argument
  if (!usersIds) usersIds = params.users
  const { reqUserId } = params

  const authorizedItems = await getAuthorizedItems.byUsers(usersIds, reqUserId)
  const page = Paginate(params)(authorizedItems)
  page.items = page.items.map(filterPrivateAttributes(reqUserId))
  return addAssociatedData(page, params)
}
