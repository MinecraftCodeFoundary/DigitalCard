import type { CardPage, CardPageIcon, CardSection } from '@/api/types'

export const pageIcons: { key: CardPageIcon, label: string, className: string }[] = [
  { key: 'user', label: '人物', className: 'i-carbon-user' },
  { key: 'company', label: '公司', className: 'i-carbon-building' },
  { key: 'product', label: '产品', className: 'i-carbon-cube' },
  { key: 'contact', label: '联系', className: 'i-carbon-phone' },
  { key: 'image', label: '图片', className: 'i-carbon-image' },
  { key: 'video', label: '视频', className: 'i-carbon-video' },
  { key: 'link', label: '链接', className: 'i-carbon-link' },
]

export function pageIconClass(icon: CardPageIcon = 'user') {
  return pageIcons.find(item => item.key === icon)?.className ?? pageIcons[0].className
}

export function portraitPages(): CardPage[] {
  return [
    { id: 'main', title: '个人简介', columns: 1, icon: 'user', presentation: 'article' },
    { id: 'company', title: '公司简介', columns: 1, icon: 'company', presentation: 'article' },
    { id: 'products', title: '产品服务', columns: 1, icon: 'product', presentation: 'cards' },
    { id: 'contact-page', title: '联系我们', columns: 1, icon: 'contact', presentation: 'article' },
  ]
}

export function defaultPages(): CardPage[] {
  return [{ id: 'main', title: '主页', columns: 1 }]
}

export function removePage(pages: CardPage[], sections: CardSection[], id: string) {
  const index = pages.findIndex(page => page.id === id)
  if (pages.length <= 1 || index < 0)
    return { pages: [...pages], sections: [...sections] }
  const fallback = pages[index === 0 ? 1 : index - 1].id
  return {
    pages: pages.filter(page => page.id !== id),
    sections: sections.map(section => (section.pageId ?? pages[0].id) === id ? { ...section, pageId: fallback } : { ...section }),
  }
}
