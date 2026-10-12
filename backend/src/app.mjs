import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import QRCode from 'qrcode'
import { randomBytes, createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { z, ZodError } from 'zod'
import { openDatabase, cardFromRow, getOrCreateUser, seedDemo, newId } from './db.mjs'
import { createWechatClient } from './wechat.mjs'
import { checkOwnedMedia, mediaAccess, registerMediaRoutes } from './media.mjs'
import { accountProfile, registerAccountRoutes } from './account.mjs'

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

export async function buildApp(options = {}) {
  const production = (options.nodeEnv ?? process.env.NODE_ENV) === 'production'
  const configuredSecret = options.jwtSecret ?? process.env.JWT_SECRET
  if (production && (!configuredSecret || configuredSecret.length < 32 || configuredSecret.startsWith('change-me'))) {
    throw new Error('生产环境必须配置至少 32 位随机 JWT_SECRET')
  }
  const secret = configuredSecret || randomBytes(32).toString('hex')
  // Sample accounts exist only in explicitly configured automated test servers.
  const demo = !production && options.nodeEnv === 'test' && options.demoEnabled === true
  // Full-feature browser regressions use explicitly opted-in demo fixtures.
  // Production membership belongs to the cloud service; never grant it to real WeChat users here.
  const testVipFixtures = demo && options.testVipFixtures === true
  const webUrl = options.webUrl ?? process.env.PUBLIC_WEB_URL ?? 'http://localhost:9000'
  const wechat = options.wechat ?? createWechatClient({
    appId: process.env.WECHAT_APP_ID, appSecret: process.env.WECHAT_APP_SECRET,
    envVersion: process.env.WECHAT_ENV_VERSION || 'develop',
  })
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 200000 })
  const databasePath = options.databasePath ?? resolve(process.env.DATABASE_PATH || './data/digital-card.sqlite')
  const db = openDatabase(databasePath)
  app.addHook('onClose', async () => db.close())
  await app.register(cors, {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    origin: (options.corsOrigins ?? process.env.CORS_ORIGINS ?? 'http://localhost:9000,http://127.0.0.1:9000').split(','),
  })
  await app.register(jwt, { secret, sign: { expiresIn: '7d' } })
  await app.register(rateLimit, { max: options.nodeEnv === 'test' ? options.rateLimitMax ?? 120 : 120, timeWindow: '1 minute' })
  if (demo) seedDemo(db)
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ code: 400, message: error.issues[0]?.message || '请求参数不正确' })
    const status = error.statusCode || 500
    if (status >= 500) request.log.error({ err: error }, 'request failed')
    reply.code(status).send({ code: status, message: status === 500 ? '服务暂时不可用，请稍后重试' : error.message })
  })
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ code: 404, message: '接口不存在' }))

  async function auth(request) {
    try { await request.jwtVerify() }
    catch { throw fail('登录已过期，请重新登录', 401) }
    const user = db.prepare('SELECT id, identity FROM users WHERE id = ?').get(request.user.sub)
    if (!user) throw fail('账号不存在，请重新登录', 401)
    const provider = user.identity.startsWith('wx:') ? 'wechat' : demo && user.identity.startsWith('demo:') ? 'demo' : null
    // Old password sessions (including accounts previously bound to WeChat) must
    // re-authenticate through WeChat. Existing account data remains untouched.
    if (!provider || request.user.provider !== provider) throw fail('请使用微信重新登录', 401)
    const credential = db.prepare('SELECT version FROM account_credentials WHERE user_id = ?').get(request.user.sub)
    if ((request.user.version ?? 0) !== (credential?.version ?? 0)
      || db.prepare('SELECT 1 FROM revoked_tokens WHERE token_id = ?').get(request.user.jti || request.headers.authorization.slice(7)))
      throw fail('登录已过期，请重新登录', 401)
  }
  async function optionalAuth(request) {
    if (request.headers.authorization) await auth(request)
  }
  function ownCard(userId) { return db.prepare('SELECT * FROM cards WHERE owner_id = ?').get(userId) }
  function fixtureIsVip(user) { return testVipFixtures && /^(?:demo:|seed:)/.test(user?.identity || '') }
  function profile(user) {
    const isVip = fixtureIsVip(user)
    return accountProfile(user, testVipFixtures ? { plan: isVip ? 'vip' : 'free', expiresAt: null, isVip } : undefined)
  }
  function serializedCard(row) {
    return { ...cardFromRow(row), ...(testVipFixtures ? {
      isVip: fixtureIsVip(db.prepare('SELECT identity FROM users WHERE id = ?').get(row.owner_id)),
    } : {}) }
  }
  function ownCardData(userId) {
    const card = serializedCard(ownCard(userId))
    return { ...card, mediaAccess: mediaAccess(card, userId, secret) }
  }
  function visibleCard(id, userId) {
    const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(idSchema.parse(id))
    if (!row || !JSON.parse(row.body).published && row.owner_id !== userId) throw fail('名片不存在或已设为私密', 404)
    return row
  }
  function loginResult(user, devKey) {
    const account = profile(user)
    const credential = db.prepare('SELECT version FROM account_credentials WHERE user_id = ?').get(user.id)
    return ok({ token: app.jwt.sign({ sub: user.id, jti: newId(), provider: account.mode, version: credential?.version ?? 0 }), expiresIn: 604800, devKey,
      card: ownCardData(user.id), mode: account.mode, account })
  }

  registerAccountRoutes(app, { db, auth, profile })

  app.get('/api/health', async () => ok({ status: 'ok', demoEnabled: demo }))
  app.post('/api/auth/dev', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request) => {
    if (!demo) throw fail('体验登录在此环境中未启用', 403)
    const body = z.object({ devKey: z.string().regex(/^[a-f\d]{64}$/).optional() }).strict().parse(request.body ?? {})
    const devKey = body.devKey || randomBytes(32).toString('hex')
    const identity = `demo:${createHash('sha256').update(devKey).digest('hex')}`
    if (body.devKey && !db.prepare('SELECT id FROM users WHERE identity = ?').get(identity)) throw fail('体验账号已失效，请重试', 401)
    const user = getOrCreateUser(db, identity, true)
    for (const cardId of ['sample-chen', 'sample-su', 'sample-zhou']) {
      // Seed favorites only on the user's initial login; removed favorites stay removed.
      if (!body.devKey) db.prepare('INSERT OR IGNORE INTO favorites VALUES (?, ?, ?)').run(user.id, cardId, new Date().toISOString())
    }
    return loginResult(user, devKey)
  })
  app.post('/api/auth/wechat', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request) => {
    const { code } = z.object({ code: text(256).min(1) }).strict().parse(request.body)
    const openid = await wechat.login(code)
    return loginResult(getOrCreateUser(db, `wx:${openid}`))
  })
  await registerMediaRoutes(app, { db, auth, secret, directory: options.mediaDirectory ?? process.env.MEDIA_DIRECTORY ?? resolve(dirname(databasePath), 'media') })
  app.get('/api/me/card', { preHandler: auth }, async request => ok(ownCardData(request.user.sub)))
  app.get('/api/me/messages', { preHandler: auth }, async request => {
    const { page, pageSize } = z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(10),
    }).parse(request.query)
    const card = ownCard(request.user.sub)
    const total = db.prepare('SELECT COUNT(*) AS total FROM messages WHERE card_id = ?').get(card.id).total
    const items = db.prepare(`SELECT id, name, contact, content, created_at AS createdAt FROM messages
      WHERE card_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(card.id, pageSize, (page - 1) * pageSize)
    return ok({ items, total, page, pageSize })
  })
  app.post('/api/cards/:id/messages', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    const row = visibleCard(request.params.id)
    const message = z.object({
      name: text(30).min(1, '请填写你的称呼'),
      contact: text(120).default(''),
      content: text(1000).min(1, '请填写留言内容'),
    }).strict().parse(request.body)
    db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)')
      .run(newId(), row.id, message.name, message.contact, message.content, new Date().toISOString())
    return ok({ submitted: true })
  })
  app.put('/api/me/card', { preHandler: auth }, async (request) => {
    const body = cardSchema.parse(request.body)
    checkOwnedMedia(db, body.sections, request.user.sub, body.appearance.coverImage, body.appearance.brandLogo)
    const updated = new Date().toISOString()
    db.prepare('UPDATE cards SET body = ?, updated_at = ? WHERE owner_id = ?').run(JSON.stringify(body), updated, request.user.sub)
    return ok(ownCardData(request.user.sub))
  })
  app.get('/api/cards/:id', { preHandler: optionalAuth }, async (request) => {
    const row = visibleCard(request.params.id, request.user?.sub)
    if (row.owner_id !== request.user?.sub) {
      const visitor = createHash('sha256').update(`${secret}:${request.user?.sub || request.ip}`).digest('hex')
      const now = new Date()
      db.prepare('INSERT OR IGNORE INTO views VALUES (?, ?, ?, ?)').run(row.id, visitor, chinaDay(now), now.toISOString())
    }
    return ok({ ...(row.owner_id === request.user?.sub ? ownCardData(row.owner_id) : serializedCard(row)), isOwner: row.owner_id === request.user?.sub,
      isFavorite: !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND card_id = ?').get(request.user?.sub || '', row.id) })
  })
  app.put('/api/cards/:id/favorite', { preHandler: auth }, async (request) => {
    const row = visibleCard(request.params.id, request.user.sub)
    if (row.owner_id === request.user.sub) throw fail('无需收藏自己的名片')
    db.exec('BEGIN IMMEDIATE')
    try {
      if (!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND card_id = ?').get(request.user.sub, row.id)) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.sub)
        const isVip = fixtureIsVip(user)
        const count = db.prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?').get(user.id).total
        if (count >= (isVip ? 50 : 10)) throw fail(isVip
          ? 'VIP 名片夹最多收藏 50 张名片，请先移除部分收藏'
          : '普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张', 403)
        db.prepare('INSERT INTO favorites VALUES (?, ?, ?)').run(user.id, row.id, new Date().toISOString())
      }
      db.exec('COMMIT')
    }
    catch (error) { db.exec('ROLLBACK'); throw error }
    return ok({ saved: true })
  })
  app.delete('/api/cards/:id/favorite', { preHandler: auth }, async (request) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND card_id = ?').run(request.user.sub, idSchema.parse(request.params.id))
    return ok({ saved: false })
  })
  app.get('/api/favorites', { preHandler: auth }, async (request) => {
    const { page, pageSize, search } = z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20), search: text(100).default(''),
    }).parse(request.query)
    // Bound by favorites belonging to the requesting user; never expose private cards.
    const rows = db.prepare(`SELECT c.*, f.created_at AS saved_at FROM favorites f
      JOIN cards c ON c.id = f.card_id WHERE f.user_id = ? AND json_extract(c.body, '$.published') = 1
      ORDER BY f.created_at DESC, c.id`).all(request.user.sub)
    const normalized = search.toLocaleLowerCase()
    const cards = rows.map(row => ({ ...serializedCard(row), savedAt: row.saved_at }))
      .filter(card => [card.name, card.title, card.company, ...card.tags].join(' ').toLocaleLowerCase().includes(normalized))
    // Return only saved identifiers for unavailable cards, so their collector
    // can release the occupied slots without exposing any private card data.
    const unavailableIds = db.prepare(`SELECT f.card_id FROM favorites f
      LEFT JOIN cards c ON c.id = f.card_id WHERE f.user_id = ?
        AND (c.id IS NULL OR COALESCE(json_extract(c.body, '$.published'), 0) <> 1)
      ORDER BY f.created_at DESC, f.card_id`).all(request.user.sub).map(row => row.card_id)
    return ok({ items: cards.slice((page - 1) * pageSize, page * pageSize), total: cards.length, page, pageSize, unavailableIds })
  })
  app.get('/api/me/stats', { preHandler: auth }, async (request) => {
    const card = ownCard(request.user.sub)
    const today = chinaDay()
    const views = db.prepare('SELECT COUNT(*) AS total FROM views WHERE card_id = ?').get(card.id).total
    const todayViews = db.prepare('SELECT COUNT(*) AS total FROM views WHERE card_id = ? AND day = ?').get(card.id, today).total
    const favorites = db.prepare('SELECT COUNT(*) AS total FROM favorites WHERE card_id = ?').get(card.id).total
    const contacts = db.prepare(`SELECT COUNT(*) AS total FROM favorites f JOIN cards c ON c.id = f.card_id
      WHERE f.user_id = ? AND json_extract(c.body, '$.published') = 1`).get(request.user.sub).total
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = chinaDay(new Date(Date.now() - (6 - index) * 86400000))
      return { day, views: db.prepare('SELECT COUNT(*) AS total FROM views WHERE card_id = ? AND day = ?').get(card.id, day).total }
    })
    return ok({ views, todayViews, favorites, contacts, days })
  })
  app.get('/api/cards/:id/qr', { preHandler: optionalAuth, config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (request) => {
    const row = visibleCard(request.params.id, request.user?.sub)
    if (!JSON.parse(row.body).published) throw fail('请先将名片设为公开')
    const mode = z.enum(['web', 'wechat']).default('web').parse(request.query.mode)
    const url = `${webUrl.replace(/\/$/, '')}/#/pages/card/card?id=${row.id}`
    const image = mode === 'wechat' ? await wechat.qr(row.id) : await QRCode.toDataURL(url, { width: 430, margin: 2, color: { dark: '#183f35', light: '#ffffff' } })
    return ok({ image, url, mode })
  })
  return app
}
