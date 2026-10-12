import type { CardAppearance, CardBody, CardTemplate, CardTheme } from '@/api/types'
import { coverColors, themeColors } from './appearance'

export type TemplateCategory = 'simple' | 'business' | 'elegant' | 'creative'

export const templateCategories: { key: 'all' | TemplateCategory, label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'simple', label: '简约' },
  { key: 'business', label: '商务' },
  { key: 'elegant', label: '雅致' },
  { key: 'creative', label: '创意' },
]

export interface CardTemplateDefinition {
  id: CardTemplate
  name: string
  description: string
  accent: string
  theme: CardTheme
  layout: CardAppearance['layout']
  avatarShape: CardAppearance['avatarShape']
  category: TemplateCategory
  usage: string
}
export const cardTemplates: CardTemplateDefinition[] = [
  { id: 'signature', name: '清新简约', description: '几何封面 · 自然配色', accent: '#234e3e', theme: 'forest', layout: 'classic', avatarShape: 'rounded', category: 'simple', usage: '日常介绍 / 个人名片' },
  { id: 'porcelain', name: '青瓷留白', description: '青釉弧线 · 素净留白', accent: '#356d68', theme: 'forest', layout: 'classic', avatarShape: 'circle', category: 'simple', usage: '独立顾问 / 文化工作者' },
  { id: 'obsidian', name: '黑金尊享', description: '墨黑金线 · 精致铭牌', accent: '#17191e', theme: 'ink', layout: 'classic', avatarShape: 'square', category: 'business', usage: '商务洽谈 / 品牌主理人' },
  { id: 'editorial', name: '杂志艺文', description: '纸感网格 · 朱红点缀', accent: '#a33b2b', theme: 'sand', layout: 'classic', avatarShape: 'square', category: 'creative', usage: '设计师 / 写作者' },
  { id: 'sunset', name: '落日暖橙', description: '暖橙日轮 · 层叠地平线', accent: '#9d422f', theme: 'sand', layout: 'centered', avatarShape: 'circle', category: 'creative', usage: '摄影师 / 生活方式品牌' },
  { id: 'aurora', name: '极光科技', description: '青绿光带 · 深海点阵', accent: '#102d3b', theme: 'ink', layout: 'classic', avatarShape: 'rounded', category: 'creative', usage: '科技团队 / 产品与研发' },
  { id: 'botanical', name: '自然森语', description: '橄榄绿叶 · 温暖纸感', accent: '#465b3c', theme: 'forest', layout: 'centered', avatarShape: 'circle', category: 'elegant', usage: '花艺 / 手作与自然品牌' },
  { id: 'poster', name: '品牌海报名片', description: '左文右人 · 品牌长海报', accent: '#168e91', theme: 'forest', layout: 'poster', avatarShape: 'square', category: 'business', usage: '企业宣传 / 业务展示' },
  { id: 'festive', name: '喜庆红金', description: '红底金字 · 花窗纹样', accent: '#ac1728', theme: 'sand', layout: 'centered', avatarShape: 'circle', category: 'elegant', usage: '庆典活动 / 传统品牌' },
  { id: 'business', name: '蓝金商务', description: '蓝金渐变 · 商务铭牌', accent: '#163f79', theme: 'ink', layout: 'classic', avatarShape: 'square', category: 'business', usage: '企业管理 / 专业服务' },
  { id: 'neon', name: '炫彩霓虹', description: '紫粉光晕 · 发光边框', accent: '#7024b8', theme: 'ink', layout: 'classic', avatarShape: 'rounded', category: 'creative', usage: '潮流创作 / 数字艺术' },
  { id: 'floral', name: '花纹雅致', description: '繁花装饰 · 玫瑰粉金', accent: '#a53f65', theme: 'sand', layout: 'centered', avatarShape: 'circle', category: 'elegant', usage: '美学工作室 / 婚礼服务' },
]
export function cardTemplateClass(card: CardBody) {
  return ['card-template', `template-${card.appearance?.template || 'signature'}`]
}
export function applyCardTemplate(appearance: CardAppearance, template: CardTemplateDefinition): CardAppearance {
  return { ...appearance, template: template.id, layout: template.layout, avatarShape: template.avatarShape, accentColor: template.accent, decoration: true }
}
export function templateCoverStyle(card: CardBody) {
  const id = card.appearance?.template || 'signature'
  if (id === 'signature')
    return {}
  const accent = card.appearance?.accentColor || themeColors[card.theme]
  const foreground = coverColors(accent).color
  if (id === 'poster')
    return { backgroundColor: '#f5fbfc', backgroundImage: `radial-gradient(ellipse at 100% 0%, ${accent}38, transparent 65%), linear-gradient(140deg, #ffffff, ${accent}12)`, color: '#263b45' }
  if (id === 'obsidian')
    return { backgroundColor: accent, backgroundImage: 'linear-gradient(135deg, #ffffff0d, transparent 55%, #00000020)', color: accent === '#17191e' ? '#ead5ac' : foreground }
  if (id === 'porcelain')
    return { backgroundColor: '#eef7f4', backgroundImage: `radial-gradient(ellipse at 100% 100%, ${accent}20, transparent 65%), linear-gradient(120deg, #ffffff70, transparent)`, color: '#234d49' }
  if (id === 'editorial')
    return { backgroundColor: '#f4eee4', backgroundImage: `linear-gradient(90deg, ${accent}08 1px, transparent 1px), linear-gradient(#ffffff40, transparent)`, backgroundSize: '32px 100%, 100% 100%', color: '#302b26' }
  if (id === 'sunset')
    return { backgroundColor: accent, backgroundImage: 'radial-gradient(ellipse at 100% 0%, #ffda9f24, transparent 70%), linear-gradient(150deg, transparent 40%, #00000018)', color: foreground }
  if (id === 'aurora')
    return { backgroundColor: accent, backgroundImage: 'radial-gradient(ellipse at 90% 0%, #71ead12b, transparent 65%), linear-gradient(145deg, #00000018, transparent)', color: foreground }
  if (id === 'botanical')
    return { backgroundColor: accent, backgroundImage: 'radial-gradient(ellipse at 0% 100%, #d9dcbd15, transparent 65%), linear-gradient(145deg, transparent, #0000001a)', color: foreground }
  if (id === 'festive')
    return { backgroundColor: accent, backgroundImage: `radial-gradient(ellipse at 50% 0%, #ffb44a35, transparent 75%), linear-gradient(155deg, ${accent}, #530713)`, color: '#ffe3a1' }
  if (id === 'business')
    return { backgroundColor: accent, backgroundImage: `radial-gradient(ellipse at 90% 15%, #6fa6ec70, transparent 65%), linear-gradient(140deg, #08182f, ${accent})`, color: '#ffdf9a' }
  if (id === 'neon')
    return { backgroundColor: accent, backgroundImage: `radial-gradient(ellipse at 95% 0%, #ef368980, transparent 65%), radial-gradient(ellipse at 0% 95%, #36f2dc55, transparent 70%), linear-gradient(140deg, #191032, ${accent})`, color: '#ffffff' }
  return { backgroundColor: accent, backgroundImage: `radial-gradient(ellipse at 30% 0%, #ffffff55, transparent 60%), linear-gradient(140deg, ${accent}, #732445)`, color: foreground }
}
