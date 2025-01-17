import _ from '#builders/utils'
import 'should'
import { authReq, authReqC } from '#tests/api/utils/utils'
import { createTransaction } from '../fixtures/transactions.js'

describe('transactions:get', () => {
  it('should get user transactions', async () => {
    const { transaction } = await createTransaction()
    const res = await authReq('get', '/api/transactions')
    res.transactions.should.be.an.Array()
    const transactionsIds = _.map(res.transactions, '_id')
    transactionsIds.should.containEql(transaction._id)
  })

  it('should not get other users transactions', async () => {
    const { transaction } = await createTransaction()
    const res = await authReqC('get', '/api/transactions')
    const transactionsIds = _.map(res.transactions, '_id')
    transactionsIds.should.not.containEql(transaction._id)
  })
})
