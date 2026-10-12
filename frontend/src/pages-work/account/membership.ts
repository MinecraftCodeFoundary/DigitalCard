import type { Membership } from '@/api/types'

export function membershipLabel(membership: Membership): string {
  if (membership.isVip)
    return 'VIP 会员'
  return membership.plan === 'vip' ? 'VIP 已到期' : '免费版'
}

export function membershipExpiry(membership: Membership): string {
  if (membership.plan === 'free')
    return '基础简易名片，可随时编辑和分享'
  if (!membership.expiresAt)
    return membership.isVip ? '长期有效' : '当前未开通 VIP'
  const date = new Date(membership.expiresAt)
  // Membership dates use Beijing time on both H5 and the mini program.
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString()
  return `${membership.isVip ? '有效期至' : '到期时间'} ${beijing.slice(0, 10)} ${beijing.slice(11, 16)}（北京时间）`
}
