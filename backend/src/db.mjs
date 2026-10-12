import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

// 24 hex characters fit WeChat's 32-character scene limit.
export const newId = () => randomBytes(12).toString('hex')
export const blankCard = {
  name: '', title: '', company: '', phone: '', email: '', wechat: '',
  location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: false,
}

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, identity TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY, owner_id TEXT UNIQUE NOT NULL REFERENCES users(id),
      body TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_credentials (
      user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id), card_id TEXT NOT NULL REFERENCES cards(id),
      created_at TEXT NOT NULL, PRIMARY KEY (user_id, card_id)
    );
    CREATE TABLE IF NOT EXISTS views (
      card_id TEXT NOT NULL REFERENCES cards(id), visitor TEXT NOT NULL,
      day TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(card_id, visitor, day)
    );
    CREATE INDEX IF NOT EXISTS idx_favorites_card ON favorites(card_id);
    CREATE INDEX IF NOT EXISTS idx_views_day ON views(card_id, day);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id),
      name TEXT NOT NULL, contact TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_card ON messages(card_id, created_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
    );
  `)
  return db
}

export function cardFromRow(row) {
  return row ? { id: row.id, ...JSON.parse(row.body), updatedAt: row.updated_at } : null
}

export function getOrCreateUser(db, identity, demo = false) {
  const existing = db.prepare('SELECT * FROM users WHERE identity = ?').get(identity)
  if (existing) return existing
  const user = { id: newId(), identity, created_at: new Date().toISOString() }
  const body = demo ? {
    ...blankCard, name: '林予安', title: '品牌策略顾问', company: '未止设计 · UNFOLD STUDIO',
    location: '上海 · 静安', bio: '让每一次相遇，都成为新的可能。\n专注品牌策略与数字体验，期待与有趣的你一起创造。',
    tags: ['品牌策略', '数字体验', '创意咨询'], published: true,
  } : blankCard
  db.exec('BEGIN')
  try {
    db.prepare('INSERT INTO users VALUES (?, ?, ?)').run(user.id, identity, user.created_at)
    db.prepare('INSERT INTO cards VALUES (?, ?, ?, ?)').run(newId(), user.id, JSON.stringify(body), user.created_at)
    db.exec('COMMIT')
  }
  catch (error) { db.exec('ROLLBACK'); throw error }
  return user
}

export function seedDemo(db) {
  const samples = [
    { id: 'sample-chen', name: '陈知远', title: '产品设计师', company: '山海科技', location: '杭州 · 滨江', bio: '用设计连接人与产品。专注体验设计与产品创新。', tags: ['产品设计', '用户体验'], theme: 'forest' },
    { id: 'sample-su', name: '苏念', title: '独立摄影师', company: '念间摄影工作室', location: '上海 · 徐汇', bio: '记录日常里的非凡。商业摄影、人物肖像与品牌影像。', tags: ['商业摄影', '品牌影像'], theme: 'sand' },
    { id: 'sample-zhou', name: '周亦川', title: '技术合伙人', company: '翌日数字', location: '深圳 · 南山', bio: '把想法变成可用的产品。小程序、网站与数字化解决方案。', tags: ['软件开发', '数字化'], theme: 'ink' },
  ]
  for (const sample of samples) {
    const user = getOrCreateUser(db, `seed:${sample.id}`)
    const row = db.prepare('SELECT id FROM cards WHERE owner_id = ?').get(user.id)
    if (row.id !== sample.id) {
      db.prepare('UPDATE cards SET id = ?, body = ? WHERE owner_id = ?')
        .run(sample.id, JSON.stringify({ ...blankCard, ...sample, published: true }), user.id)
    }
  }
}
