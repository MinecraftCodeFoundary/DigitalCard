import type { CardAppearance, CardBody, CardPage, CardSection } from '@/api/types'
import { defaultAppearance } from '@/utils/appearance'
import { defaultPages } from '@/utils/pages'
import { defaultSections } from '@/utils/sections'

export type EditableCard = CardBody & { appearance: CardAppearance, sections: CardSection[], pages: CardPage[] }

export function basicCardBody(card: CardBody): EditableCard {
  return {
    ...card,
    theme: 'forest',
    appearance: { ...defaultAppearance(), template: 'signature', layout: 'minimal', decoration: false },
    pages: defaultPages(),
    sections: defaultSections(),
  }
}

export function restoreVipStyle(draft: EditableCard, saved: EditableCard): EditableCard {
  return {
    ...draft,
    theme: saved.theme,
    appearance: saved.appearance,
    pages: saved.pages,
    sections: saved.sections,
  }
}
