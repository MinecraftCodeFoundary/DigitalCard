import { describe, expect, it } from 'vitest'
import { defaultSections, moveSection } from './sections'

describe('section ordering', () => {
  it('moves sections in both directions without mutating the saved order', () => {
    const original = [...defaultSections(), { id: 'service', type: 'text' as const, title: '服务', content: '', visible: true }]
    const reordered = moveSection(original, 2, 0)
    expect(reordered.map(section => section.id)).toEqual(['service', 'about', 'contact'])
    expect(original.map(section => section.id)).toEqual(['about', 'contact', 'service'])
    expect(moveSection(reordered, 0, 2)).toEqual(original)
    expect(moveSection(original, 0, -1)).toEqual(original)
    expect(moveSection(original, 2, 3)).toEqual(original)
    expect(moveSection([], 0, 1)).toEqual([])
  })
})
