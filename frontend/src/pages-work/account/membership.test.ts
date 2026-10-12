import { describe, expect, it } from 'vitest'
import { membershipExpiry, membershipLabel } from './membership'

describe('membership presentation', () => {
  it('distinguishes free, lifetime and expired membership', () => {
    expect(membershipLabel({ plan: 'free', expiresAt: null, isVip: false })).toBe('免费版')
    expect(membershipExpiry({ plan: 'vip', expiresAt: null, isVip: true })).toBe('长期有效')
    const expired = { plan: 'vip' as const, expiresAt: '2026-10-10T18:30:00.000Z', isVip: false }
    expect(membershipLabel(expired)).toBe('VIP 已到期')
    expect(membershipExpiry(expired)).toBe('到期时间 2026-10-11 02:30（北京时间）')
  })
})
