import { setTimeout as delay } from 'node:timers/promises'

export const collections = ['users', 'identities', 'usernames', 'credentials', 'sessions',
  'cards', 'favorites', 'views', 'messages', 'media', 'uploads', 'rate_limits']

function missing(error) {
  // wx-server-sdk returns DATABASE_REQUEST_FAILED with this documented suffix.
  // Permission/network errors must propagate instead of looking like missing users.
  return /document (?:with _id \S+ )?(?:does not exist|not exists)/i.test(error.message || error.errMsg || String(error))
}
export function isTransactionConflict(error) {
  return error?.code === 'DATABASE_TRANSACTION_CONFLICT'
    || /DATABASE_TRANSACTION_CONFLICT|ResourceUnavailable\.TransactionConflict/.test(`${error?.message || ''} ${error?.errMsg || ''}`)
}
export class CloudRepository {
  constructor(db, root = db) { this.db = db; this.root = root }
  async get(collection, id) {
    try {
      const result = await this.db.collection(collection).doc(id).get()
      const data = Array.isArray(result.data) ? result.data[0] : result.data
      if (!data) return null
      const { _id, _openid, ...record } = data
      return record
    }
    catch (error) { if (missing(error)) return null; throw error }
  }
  async set(collection, id, data) { await this.db.collection(collection).doc(id).set({ data }) }
  async remove(collection, id) { await this.db.collection(collection).doc(id).remove() }
  async list(collection, where = {}, { skip = 0, limit = 100, order = [] } = {}) {
    let query = this.db.collection(collection).where(where)
    for (const [field, direction] of [...order, ['_id', 'asc']]) query = query.orderBy(field, direction)
    const { data } = await query.skip(skip).limit(limit).get()
    return data.map(({ _id, _openid, ...record }) => record)
  }
  async count(collection, where = {}) { return (await this.db.collection(collection).where(where).count()).total }
  async all(collection, where = {}, order = []) {
    const records = []
    for (let skip = 0; ; skip += 100) {
      const batch = await this.list(collection, where, { skip, order })
      records.push(...batch)
      if (batch.length < 100) return records
    }
  }
  async transaction(work) {
    for (let attempt = 0; ; attempt++) {
      try {
        // wx-server-sdk strips the original error.code from document errors,
        // so the underlying SDK cannot recognize them for automatic retries.
        // Let each failed attempt roll back before starting a fresh transaction.
        return await this.root.runTransaction(tx => work(new CloudRepository(tx, this.root)), 0)
      }
      catch (error) {
        if (!isTransactionConflict(error) || attempt >= 5) throw error
        await delay(Math.min(50 * 2 ** attempt, 800) + Math.floor(Math.random() * 50))
      }
    }
  }
}
