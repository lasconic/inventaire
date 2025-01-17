import { map } from 'lodash-es'
import comments_ from '#controllers/comments/lib/comments'
import dbFactory from '#db/couchdb/base'
import { minKey, maxKey } from '#lib/couch'
import { BasicUpdater } from '#lib/doc_updates'
import { error_ } from '#lib/error/error'
import { emit } from '#lib/radio'
import { assert_ } from '#lib/utils/assert_types'
import { sameObjects } from '#lib/utils/base'
import { log } from '#lib/utils/logs'
import Transaction from '#models/transaction'

const db = await dbFactory('transactions')

export const getTransactionById = db.get
export const getTransactionsByUser = userId => {
  return db.viewCustom('byUserAndItem', {
    // get all the docs with this userId
    startkey: [ userId, minKey ],
    endkey: [ userId, maxKey ],
    include_docs: true,
  })
}

export const getTransactionsByUserAndItem = (userId, itemId) => {
  assert_.strings([ userId, itemId ])
  return db.viewByKey('byUserAndItem', [ userId, itemId ])
}

export const createTransaction = async (itemDoc, ownerDoc, requesterDoc) => {
  const transaction = Transaction.create(itemDoc, ownerDoc, requesterDoc)
  log(transaction, 'transaction')
  const couchRes = await db.post(transaction)
  await emit('transaction:request', couchRes.id)
  return couchRes
}

export const addTransactionMessage = (userId, message, transactionId) => {
  assert_.strings([ userId, message, transactionId ])
  if (message) {
    return comments_.addTransactionComment(userId, message, transactionId)
  }
}

export const updateTransactionState = async (transaction, newState, userId) => {
  Transaction.validatePossibleState(transaction, newState)
  await db.update(transaction._id, stateUpdater(newState, userId, transaction))
  await emit('transaction:update', transaction, newState)
}

export const markTransactionAsRead = (userId, transaction) => {
  const role = userRole(userId, transaction)
  // Not handling cases when both user are connected:
  // should be clarified once sockets/server events will be implemented
  return db.update(transaction._id, BasicUpdater(`read.${role}`, true))
}

export const updateReadForNewMessage = async (userId, transaction) => {
  const updatedReadStates = updateReadStates(userId, transaction)
  // Spares a db write if updatedReadStates is already the current read state object
  if (sameObjects(updatedReadStates, transaction.read)) return
  return db.update(transaction._id, BasicUpdater('read', updatedReadStates))
}

export const getUserActiveTransactionsCount = userId => {
  return getTransactionsByUser(userId)
  .then(activeCount)
}

export const cancelAllActiveTransactions = async userId => {
  const transactions = await getTransactionsByUser(userId)
  const activeTransactions = transactions.filter(Transaction.isActive)
  await Promise.all(activeTransactions.map(transaction => {
    return updateTransactionState(transaction, 'cancelled', userId)
  }))
}

export const checkIfItemIsBusy = async itemId => {
  assert_.string(itemId)
  const rows = await getBusyItems([ itemId ])
  return rows.length > 0
}

export const setItemsBusyFlag = async items => {
  assert_.objects(items)
  const itemsIdsToCheck = map(items.filter(mayBeBusy), '_id')
  const rows = await getBusyItems(itemsIdsToCheck)
  const busyItemsIds = new Set(map(rows, 'key'))
  return items.map(item => {
    item.busy = busyItemsIds.has(item._id)
    return item
  })
}

const mayBeBusy = item => item.transaction !== 'inventorying'

const getBusyItems = async itemsIds => {
  if (itemsIds.length === 0) return []
  const { rows } = await db.viewKeys('transactions', 'byBusyItem', itemsIds, { include_docs: false })
  return rows
}

const stateUpdater = (state, userId, transaction) => {
  const updatedReadStates = updateReadStates(userId, transaction)
  return doc => {
    doc.state = state
    const action = { action: state, timestamp: Date.now() }
    // keep track of the actor when it can be both
    if (actorCanBeBoth.includes(state)) {
      const role = userRole(userId, transaction)
      action.actor = role
    }
    doc.actions.push(action)
    doc.read = updatedReadStates
    return doc
  }
}

const actorCanBeBoth = [ 'cancelled' ]

const updateReadStates = (userId, transaction) => {
  const role = userRole(userId, transaction)
  if (role === 'owner') return { owner: true, requester: false }
  else if (role === 'requester') return { owner: false, requester: true }
  else throw error_.new('updateReadStates err', 500, { userId, transaction })
}

const userRole = (userId, transaction) => {
  const { owner, requester } = transaction
  if (userId === owner) return 'owner'
  else if (userId === requester) return 'requester'
  else throw error_.new('no role found', 500, { userId, transaction })
}

const activeCount = transactions => transactions.filter(Transaction.isActive).length
