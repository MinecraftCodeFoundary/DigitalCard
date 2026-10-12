// Test-only substitutes. Production always constructs CloudRepository/CloudStorage.
export class MemoryRepository {
  constructor() { this.records = new Map(); this.queue = Promise.resolve() }
  key(collection, id) { return `${collection}:${id}` }
  async get(collection, id) { return structuredClone(this.records.get(this.key(collection, id)) || null) }
  async set(collection, id, data) { this.records.set(this.key(collection, id), structuredClone(data)) }
  async remove(collection, id) { this.records.delete(this.key(collection, id)) }
  async all(collection, where = {}, order = []) {
    const records = [...this.records].filter(([key, value]) => key.startsWith(`${collection}:`) && Object.entries(where).every(([field, expected]) => value[field] === expected)).map(([, value]) => structuredClone(value))
    return records.sort((a, b) => {
      for (const [field, direction] of order) {
        const comparison = String(a[field]).localeCompare(String(b[field]))
        if (comparison) return direction === 'desc' ? -comparison : comparison
      }
      return String(a.id || '').localeCompare(String(b.id || ''))
    })
  }
  async list(collection, where, { skip = 0, limit = 100, order = [] } = {}) { return (await this.all(collection, where, order)).slice(skip, skip + limit) }
  async count(collection, where) { return (await this.all(collection, where)).length }
  async transaction(work) {
    const run = this.queue.then(async () => {
      const snapshot = structuredClone(this.records)
      try { return await work(this) }
      catch (error) { this.records = snapshot; throw error }
    })
    this.queue = run.catch(() => {})
    return run
  }
}
export class MemoryStorage {
  constructor(env = 'cloud-test') { this.env = env; this.files = new Map() }
  async upload(path, buffer) { const id = `cloud://${this.env}.bucket/${path}`; this.files.set(id, buffer); return id }
  async download(id) { if (!this.files.has(id)) throw new Error('missing file'); return this.files.get(id) }
  async remove(id) { this.files.delete(id) }
  async urls(ids) { return Object.fromEntries(ids.map(id => [id, `https://signed.example.test/${encodeURIComponent(id)}?ttl=300`])) }
}
