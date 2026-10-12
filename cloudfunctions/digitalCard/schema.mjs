import { z } from 'zod'
const text = max => z.string().trim().max(max)
const mediaUrl = text(2000).refine(value => {
  if (!value || /^\/api\/media\/[a-f\d]{24}$/.test(value)) return true
  if (!/^https?:\/\//.test(value) || !z.url().safeParse(value).success) return false
  const url = new URL(value)
  return !url.username && !url.password
}, '请输入有效的 http:// 或 https:// 链接')
const appearanceSchema = z.object({
  template: z.enum(['signature', 'festive', 'business', 'neon', 'floral', 'poster', 'obsidian', 'porcelain', 'editorial', 'sunset', 'aurora', 'botanical']).optional(),
  layout: z.enum(['classic', 'centered', 'minimal', 'portrait', 'poster']).default('classic'),
  coverImage: mediaUrl.optional(),
  brandLogo: mediaUrl.optional(),
  posterPortraitScale: z.number().min(0.7).max(1.4).optional(),
  posterPortraitX: z.number().min(-20).max(20).optional(),
  posterFooter: text(60).optional(),
  accentColor: z.string().regex(/^(?:#[a-fA-F\d]{6})?$/, '自定义颜色需为六位十六进制色值，例如 #234e3e').default(''),
  coverLabel: text(32).default('THE ART OF CONNECTION'),
  coverTitle: text(48).default('每一次相遇\n都有新的可能。'),
  wordmark: text(24).default('YIMIAN.'),
  avatarShape: z.enum(['rounded', 'circle', 'square']).default('rounded'),
  decoration: z.boolean().default(true),
  hiddenFields: z.array(z.enum(['title', 'company', 'location', 'tags'])).max(4).default([]),
}).strict()
const contentFields = {
  id: z.string().regex(/^[a-z\d-]{1,60}$/),
  title: text(40).min(1, '请填写模块标题'), content: text(1000), visible: z.boolean(),
  showTitle: z.boolean().optional(),
  columnSpan: z.union([z.literal(1), z.literal(2)]).optional(),
  images: z.array(mediaUrl.refine(value => !!value, '图片地址不能为空')).max(6).optional(),
  url: mediaUrl.optional(), poster: mediaUrl.optional(), imageLayout: z.enum(['grid', 'stack']).optional(),
  buttonLabel: text(30).optional(),
}
function validateMedia(section, context) {
  if (section.type === 'image' && !section.images?.length) context.addIssue({ code: 'custom', message: '请为图片模块添加图片' })
  if (['video', 'link'].includes(section.type) && !section.url) context.addIssue({ code: 'custom', message: section.type === 'video' ? '请上传视频或填写视频地址' : '请填写链接地址' })
  if (section.type === 'link' && !/^https?:\/\//.test(section.url || '')) context.addIssue({ code: 'custom', message: '链接需以 http:// 或 https:// 开头' })
}
const blockSchema = z.object({ ...contentFields, type: z.enum(['text', 'image', 'video', 'link']) }).strict().superRefine(validateMedia)
const sectionSchema = z.object({
  ...contentFields, type: z.enum(['about', 'contact', 'text', 'image', 'video', 'link', 'card']),
  pageId: z.string().regex(/^[a-z\d-]{1,60}$/).optional(),
  blocks: z.array(blockSchema).max(20, '每张 Card 最多添加 20 项内容')
    .refine(blocks => new Set(blocks.map(block => block.id)).size === blocks.length, 'Card 内的内容编号不能重复').optional(),
  cardLayout: z.enum(['stack', 'columns', 'showcase']).optional(),
}).strict().superRefine((section, context) => {
  validateMedia(section, context)
  if (section.type === 'card' && !section.blocks) context.addIssue({ code: 'custom', message: 'Card 缺少内部内容列表' })
  if (section.type !== 'card' && (section.blocks !== undefined || section.cardLayout !== undefined)) context.addIssue({ code: 'custom', message: '只有 Card 可以包含内部内容和排版设置' })
})
const sectionsSchema = z.array(sectionSchema).max(30, '最多添加 30 个内容块')
  .refine(sections => new Set(sections.map(section => section.id)).size === sections.length, '模块编号不能重复')
  .refine(sections => ['about', 'contact'].every(type => sections.filter(section => section.type === type).length <= 1), '简介和联系方式模块各只能添加一个')
const cardSchema = z.object({
  name: text(30).min(1, '请输入姓名'), title: text(60), company: text(80),
  phone: text(30).refine(v => !v || /^[+\d\s()-]{5,30}$/.test(v), '电话号码格式不正确'),
  email: text(120).refine(v => !v || z.email().safeParse(v).success, '邮箱格式不正确'),
  wechat: text(60), location: text(100), bio: text(500),
  avatar: text(150000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), '头像格式不正确'),
  website: text(200).refine(v => !v || /^https?:\/\//.test(v) && z.url().safeParse(v).success, '网址需以 http:// 或 https:// 开头'),
  tags: z.array(text(16).min(1)).max(5), theme: z.enum(['forest', 'sand', 'ink']), published: z.boolean(),
  appearance: appearanceSchema.prefault({}),
  pages: z.array(z.object({
    id: z.string().regex(/^[a-z\d-]{1,60}$/), title: text(24).min(1, '请填写页面名称'),
    columns: z.union([z.literal(1), z.literal(2)]),
    icon: z.enum(['user', 'company', 'product', 'contact', 'image', 'video', 'link']).optional(),
    presentation: z.enum(['cards', 'article']).optional(),
  }).strict()).min(1, '至少保留一个页面').max(6, '最多添加 6 个页面')
    .refine(pages => new Set(pages.map(page => page.id)).size === pages.length, '页面编号不能重复')
    .default([{ id: 'main', title: '主页', columns: 1 }]),
  sections: sectionsSchema.default([
    { id: 'about', type: 'about', title: '关于我', content: '', visible: true },
    { id: 'contact', type: 'contact', title: '保持联系', content: '', visible: true },
  ]),
}).strict().superRefine((card, context) => {
  const ids = new Set(card.pages.map(page => page.id))
  if (card.sections.some(section => section.pageId !== undefined && !ids.has(section.pageId)))
    context.addIssue({ code: 'custom', message: '模块所属页面不存在' })
})
const idSchema = z.string().regex(/^(?:[a-f\d]{24}|sample-(?:chen|su|zhou))$/, '名片编号不正确')
const ok = data => ({ code: 0, data })
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
// Analytics use China calendar days, regardless of the server timezone.
export const chinaDay = (date = new Date()) => new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10)


export { cardSchema, idSchema, text, fail, ok }

