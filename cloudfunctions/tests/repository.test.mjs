import test from 'node:test'
import assert from 'node:assert/strict'
import { CloudRepository } from '../digitalCard/repository.mjs'
test('repository recognizes the real wx SDK missing document error and propagates outages', async () => {
  let error = { errMsg: 'document.get:fail document with _id abc does not exist' }
  const db = { collection: () => ({ doc: () => ({ get: async () => { throw error } }) }) }
  const repo = new CloudRepository(db)
  assert.equal(await repo.get('users', 'abc'), null)
  error = new Error('permission denied')
  await assert.rejects(repo.get('users', 'abc'), /permission denied/)
  error = new Error('collection does not exist')
  await assert.rejects(repo.get('users', 'abc'), /collection/)
})
test('repository strips system fields and uses the wx set envelope in transactions', async () => {
  const calls = []
  const document = { get: async () => ({ data: { _id: 'a', _openid: 'private', name: 'Alice' } }),
    set: async input => calls.push(input) }
  const tx = { collection: () => ({ doc: () => document }) }
  const repo = new CloudRepository({ ...tx, runTransaction: async work => work(tx) })
  assert.deepEqual(await repo.get('users', 'a'), { name: 'Alice' })
  await repo.transaction(async store => store.set('users', 'a', { name: 'Bob' }))
  assert.deepEqual(calls, [{ data: { name: 'Bob' } }])
})
test('all pagination reads beyond one SDK batch', async () => {
  const repo = new CloudRepository({})
  const rows = Array.from({ length: 235 }, (_, id) => ({ id }))
  repo.list = async (_, __, { skip, limit = 100 }) => rows.slice(skip, skip + limit)
  assert.equal((await repo.all('favorites')).length, 235)
})

test('conflicts retry with a fresh transaction without committing a failed increment', async () => {
  let committed = 0, attempts = 0
  const db = {
    runTransaction: async (work, retries) => {
      assert.equal(retries, 0, 'the repository controls rollback and retry boundaries')
      let staged = committed
      const tx = { collection: () => ({ doc: () => ({
        get: async () => ({ data: { count: staged } }),
        set: async ({ data }) => { staged = data.count },
      }) }) }
      const result = await work(tx)
      attempts++
      if (attempts === 1) throw { code: 'DATABASE_TRANSACTION_CONFLICT' }
      if (attempts === 2) throw Object.assign(new Error('document.set:fail -501001 [ResourceUnavailable.TransactionConflict]'), { errCode: -501001 })
      committed = staged
      return result
    },
  }
  const repo = new CloudRepository(db)
  assert.equal(await repo.transaction(async tx => {
    const record = await tx.get('rate_limits', 'bucket')
    await tx.set('rate_limits', 'bucket', { count: record.count + 1 })
    return 'committed'
  }), 'committed')
  assert.equal(attempts, 3)
  assert.equal(committed, 1)
})

test('transaction retries are bounded and preserve the final wrapped error', async () => {
  const error = { errMsg: 'document.set:fail DATABASE_TRANSACTION_CONFLICT' }
  let attempts = 0
  const repo = new CloudRepository({ runTransaction: async () => { attempts++; throw error } })
  await assert.rejects(repo.transaction(() => {}), e => e === error)
  assert.equal(attempts, 6)
})

test('validation, permission and generic system errors never retry a transaction', async () => {
  for (const error of [Object.assign(new Error('username taken'), { statusCode: 409 }),
    new Error('permission denied'), { errCode: -501001, errMsg: 'resource system error' }]) {
    let attempts = 0
    const repo = new CloudRepository({ runTransaction: async () => { attempts++; throw error } })
    await assert.rejects(repo.transaction(() => {}), e => e === error)
    assert.equal(attempts, 1)
  }
})
