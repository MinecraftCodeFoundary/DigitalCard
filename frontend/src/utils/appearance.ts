import type { CardAppearance, CardTheme } from '@/api/types'

export function defaultAppearance(): CardAppearance {
  return {
    layout: 'classic',
    accentColor: '',
    coverLabel: 'THE ART OF CONNECTION',
    coverTitle: '每一次相遇\n都有新的可能。',
    wordmark: 'YIMIAN.',
    avatarShape: 'rounded',
    decoration: true,
    hiddenFields: [],
  }
}

export const themeColors: Record<CardTheme, string> = {
  forest: '#234e3e',
  sand: '#8c6444',
  ink: '#2a3549',
}

export function coverColors(color: string) {
  const channels = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  return { background: color, color: luminance > 0.179 ? '#17251d' : '#ffffff' }
}
