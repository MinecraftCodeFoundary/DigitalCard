import test from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, getOrCreateUser } from '../src/db.mjs'
import { migrationPlan } from '../scripts/migration-plan.mjs'
import { digest } from '../../cloudfunctions/digitalCard/service.mjs'
test('migration retains real account IDs, password hashes and relationships while excluding demos', () => {
  const db = openDatabase(':memory:')
  try {
    const wx = getOrCreateUser(db, 'wx:trusted-openid')
    const demo = getOrCreateUser(db, 'demo:old-device', true)
    getOrCreateUser(db, 'seed:sample')
    const bound = getOrCreateUser(db, 'demo:bound-device', true)
    db.prepare('INSERT INTO account_credentials VALUES (?, ?, ?, ?, ?)').run(bound.id, 'bound', 'hash-kept', 'salt-kept', 7)
    const cards = db.prepare('SELECT * FROM cards WHERE owner_id IN (?, ?)').all(wx.id, bound.id)
    const card = cards.find(card => card.owner_id === wx.id)
    db.prepare('INSERT INTO favorites VALUES (?, ?, ?)').run(bound.id, card.id, '2026-10-10T00:00:00.000Z')
    const plan = migrationPlan(db)
    assert.equal(plan.excludedUsers, 2)
    assert.equal(plan.writes.some(write => write.id === demo.id), false)
    assert.equal(plan.writes.find(write => write.collection === 'users' && write.id === bound.id).data.identity, `account:${bound.id}`)
    const credential = plan.writes.find(write => write.collection === 'credentials')
    assert.equal(credential.data.password_hash, 'hash-kept')
    assert.equal(credential.data.version, 7)
    assert.equal(plan.writes.find(write => write.collection === 'identities').id, digest('wx:trusted-openid'))
    assert.equal(plan.writes.find(write => write.collection === 'favorites').data.cardId, card.id)
    assert.equal(plan.writes.filter(write => write.collection === 'cards').length, cards.length)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 4)
  }
  finally { db.close() }
})
