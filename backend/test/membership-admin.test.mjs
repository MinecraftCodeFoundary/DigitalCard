import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMembershipArgs, executeMembership } from '../scripts/set-membership.mjs'

const clock = Date.UTC(2026, 9, 11)
const id = 'a'.repeat(24)
function database(user) {
  const state = { user: structuredClone(user), updates: 0, transactions: 0 }
  const db = {
    collection(name) {
      assert.equal(name, 'users')
      return { doc(userId) {
        assert.equal(userId, id)
        return {
          get: async () => ({ data: state.user ? [structuredClone(state.user)] : [] }),
          update: async value => { state.updates++; Object.assign(state.user, structuredClone(value)); return {} },
        }
      } }
    },
    runTransaction: async work => { state.transactions++; return work(db) },
  }
  return { db, state }
}

test('membership admin validates exact target, explicit timezone, future expiry and operation flags', () => {
  for (const args of [[], ['delete', '--user-id', id], ['grant'], ['grant', '--user-id', '*'],
    ['grant', '--user-id', ` ${id}`], ['grant', '--user-id', '../users'],
    ['grant', '--user-id', id, '--user-id', id], ['grant', '--user-id', id, '--unknown'],
    ['status', '--user-id', id, '--apply'], ['revoke', '--user-id', id, '--expires-at', '2027-01-01T00:00:00Z'],
    ['grant', '--user-id', id, '--expires-at', '2027-01-01'],
    ['grant', '--user-id', id, '--expires-at', '2027-01-01T00:00:00'],
    ['grant', '--user-id', id, '--expires-at', '2027-02-30T00:00:00Z'],
    ['grant', '--user-id', id, '--expires-at', new Date(clock).toISOString()],
  ]) assert.throws(() => parseMembershipArgs(args, clock), undefined, JSON.stringify(args))
  assert.deepEqual(parseMembershipArgs(['grant', '--user-id', id], clock), { action: 'grant', userId: id, apply: false })
  assert.equal(parseMembershipArgs(['grant', '--user-id', id, '--expires-at', '2027-01-01T08:00:00+08:00'], clock).expiresAt,
    '2027-01-01T00:00:00.000Z')
})

test('admin status and grant preview never write; applying grants updates only membership fields', async () => {
  const original = { id, cardId: 'b'.repeat(24), identity: 'wx:private', createdAt: '2026-01-01', custom: 'preserved' }
  const { db, state } = database(original)
  const status = await executeMembership(db, parseMembershipArgs(['status', '--user-id', id], clock), () => clock)
  assert.equal(status.after.isVip, false)
  const preview = await executeMembership(db, parseMembershipArgs(['grant', '--user-id', id], clock), () => clock)
  assert.equal(preview.applied, false)
  assert.equal(preview.after.isVip, true)
  assert.equal(state.updates, 0)
  assert.deepEqual(state.user, original)
  const applied = await executeMembership(db, parseMembershipArgs(['grant', '--user-id', id, '--apply'], clock), () => clock)
  assert.equal(applied.applied, true)
  assert.equal(state.transactions, 1)
  assert.equal(state.updates, 1)
  assert.deepEqual(state.user, { ...original, membership: { plan: 'vip', expiresAt: null }, membershipUpdatedAt: new Date(clock).toISOString() })
  assert.equal('identity' in applied, false)
})

test('admin supports expiring VIP and revoke, refusing missing or mismatched accounts and expired previews', async () => {
  const { db, state } = database({ id, cardId: 'card', membership: { plan: 'free', expiresAt: null } })
  const options = parseMembershipArgs(['grant', '--user-id', id, '--expires-at', '2026-10-12T00:00:00Z', '--apply'], clock)
  assert.equal((await executeMembership(db, options, () => clock)).after.isVip, true)
  assert.equal(state.user.membership.expiresAt, '2026-10-12T00:00:00.000Z')
  const revoked = await executeMembership(db, parseMembershipArgs(['revoke', '--user-id', id, '--apply'], clock), () => clock)
  assert.deepEqual(revoked.after, { plan: 'free', expiresAt: null, isVip: false })
  const writes = state.updates
  await assert.rejects(executeMembership(db, options, () => Date.parse(options.expiresAt)), /到期时间已过/)
  assert.equal(state.updates, writes)
  for (const user of [null, { id: 'different', cardId: 'card' }]) {
    const missing = database(user)
    await assert.rejects(executeMembership(missing.db, options, () => clock), /不存在或记录不匹配/)
    assert.equal(missing.state.updates, 0)
  }
})
