import type { CardSection } from '@/api/types'

export function defaultSections(): CardSection[] {
  return [
    { id: 'about', type: 'about', title: '关于我', content: '', visible: true },
    { id: 'contact', type: 'contact', title: '保持联系', content: '', visible: true },
  ]
}

export function moveSection(sections: CardSection[], from: number, to: number): CardSection[] {
  const result = [...sections]
  if (from < 0 || from >= result.length || to < 0 || to >= result.length)
    return result
  const [section] = result.splice(from, 1)
  result.splice(to, 0, section)
  return result
}
