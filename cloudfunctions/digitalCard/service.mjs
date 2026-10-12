import { createHash, randomBytes } from 'node:crypto'
import { z, ZodError } from 'zod'
import QRCode from 'qrcode'
import { cardSchema, idSchema, text, fail, ok, chinaDay } from './schema.mjs'
import { mediaId, sectionMedia, sources, inspectFile } from './storage.mjs'
import { isTransactionConflict } from './repository.mjs'
import { FREE_APPEARANCE, FREE_PAGES, FREE_SECTIONS, membershipProfile, requireVip, assertFavoriteCapacity,
  projectCardBody, prepareFreeInput, assertFreeCard, mergeBasicFields } from './membership.mjs'

export const newId = () => randomBytes(12).toString('hex')
export const digest = value => createHash('sha256').update(value).digest('hex')
export const blankCard = { name: '', title: '', company: '', phone: '', email: '', wechat: '',
  location: '', bio: '', avatar: '', website: '', tags: [], theme: 'forest', published: false,
  appearance: FREE_APPEARANCE, pages: FREE_PAGES, sections: FREE_SECTIONS }
const pagination = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10), search: text(100).default('') })
const envelope = z.object({ path: z.string().max(2200), method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
  data: z.unknown().optional(), token: z.string().max(256).optional(), gatewayIp: z.string().max(100).optional() }).strict()

export function createService({ repository: db, storage, appId, envId, webUrl, envVersion = 'develop', qr,
  clock = () => Date.now(), logger = console }) {
  const now = () => new Date(clock()).toISOString()
  const profile = user => ({ id: user.id, mode: 'wechat', createdAt: user.createdAt, membership: membershipProfile(user, clock()) })
  async function auth(token, store = db) {
    if (!token || !/^[a-f\d]{64}$/.test(token)) throw fail('请使用微信登录', 401)
    const session = await store.get('sessions', digest(token))
    // Legacy sessions do not record how they authenticated. Require a fresh
    // trusted WeChat login, even for users who formerly bound a password.
    if (!session || session.authMethod !== 'wechat' || session.expiresAt <= clock()) throw fail('登录已过期，请使用微信重新登录', 401)
    const user = await store.get('users', session.userId)
    const identity = user?.identity?.startsWith('wx:') ? await store.get('identities', digest(user.identity)) : null
    if (!identity || identity.userId !== user.id) throw fail('登录已过期，请使用微信重新登录', 401)
    return user
  }
  async function limit(key, max) {
    const bucket = Math.floor(clock() / 60000)
    const id = digest(`${key}:${bucket}`)
    await db.transaction(async tx => {
      const record = await tx.get('rate_limits', id)
      if ((record?.count || 0) >= max) throw fail('操作过于频繁，请稍后重试', 429)
      await tx.set('rate_limits', id, { count: (record?.count || 0) + 1, expiresAt: new Date((bucket + 2) * 60000) })
    })
  }
  async function own(user) {
    const card = await db.get('cards', user.cardId)
    if (!card || card.ownerId !== user.id) throw fail('名片不存在', 404)
    return card
  }
  async function visible(id, user) {
    const card = await db.get('cards', idSchema.parse(id))
    if (!card || !card.body.published && card.ownerId !== user?.id) throw fail('名片不存在或已设为私密', 404)
    return card
  }
  async function cardData(card, owner = false) {
    const account = await db.get('users', card.ownerId)
    const accessTime = clock()
    const body = projectCardBody(card.body, account, accessTime)
    const isVip = membershipProfile(account, accessTime).isVip
    // Sign only visible media for public readers; keep storage fileIDs private.
    const urls = [...new Set(sources(body, !owner).filter(mediaId))]
    const files = await Promise.all(urls.map(async url => ({ url, record: await db.get('media', mediaId(url)) })))
    const valid = files.filter(file => file.record?.ownerId === card.ownerId)
    let signed = {}, mediaUnavailable = false
    try {
      if (valid.length) signed = await storage.urls(valid.map(file => file.record.fileID))
    }
    catch (error) {
      // Media previews are secondary: a committed card must not look unsaved
      // just because temporary URL signing is unavailable.
      mediaUnavailable = true
      logger.error('Card media URLs failed', { cardId: card.id, message: error.message })
    }
    return { id: card.id, ...body, isVip, updatedAt: card.updatedAt,
      mediaAccess: Object.fromEntries(valid.filter(file => signed[file.record.fileID]).map(file => [file.url, signed[file.record.fileID]])),
      ...(mediaUnavailable ? { mediaUnavailable: true } : {}) }
  }
  async function login(user) {
    const token = randomBytes(32).toString('hex')
    await db.set('sessions', digest(token), { userId: user.id, authMethod: 'wechat',
      expiresAt: clock() + 604800000, expiresOn: new Date(clock() + 604800000) })
    const account = profile(user)
    return { token, expiresIn: 604800, card: await cardData(await own(user), true), mode: account.mode, account }
  }
  async function createUser(tx, identity) {
    const user = { id: newId(), cardId: newId(), identity, analyticsSalt: randomBytes(32).toString('hex'), createdAt: now(),
      membership: { plan: 'free', expiresAt: null } }
    await tx.set('users', user.id, user)
    await tx.set('cards', user.cardId, { id: user.cardId, ownerId: user.id, body: blankCard, updatedAt: now() })
    return user
  }
  async function ownedMedia(body, user) {
    const sections = [...body.sections, { type: 'image', images: [body.appearance.coverImage, body.appearance.brandLogo].filter(Boolean) }]
    for (const section of sections.flatMap(section => section.type === 'card' ? section.blocks || [] : [section])) {
      for (const url of sectionMedia(section)) {
        const id = mediaId(url)
        if (!id) continue
        const record = await db.get('media', id)
        if (!record || record.ownerId !== user.id) throw fail('上传的媒体不存在或不属于当前账号')
        if (record.kind !== (section.type === 'video' && section.url === url ? 'video' : 'image')) throw fail('媒体类型与模块不匹配')
      }
    }
  }
  const favoriteKey = (user, card) => digest(`${user.id}:${card}`)
  async function favorites(user, search = '') {
    const rows = await db.all('favorites', { userId: user.id }, [['createdAt', 'desc']])
    const cards = []
    const unavailableIds = []
    for (const favorite of rows) {
      const card = await db.get('cards', favorite.cardId)
      if (!card?.body.published) {
        unavailableIds.push(favorite.cardId)
        continue
      }
      const body = card.body
      if ([body.name, body.title, body.company, ...body.tags].join(' ').toLowerCase().includes(search.toLowerCase()))
        cards.push({ card, savedAt: favorite.createdAt })
    }
    return { cards, unavailableIds }
  }
  async function route(event, context) {
    const url = new URL(event.path, 'https://digital-card.invalid')
    if (!url.pathname.startsWith('/api/')) throw fail('接口不存在', 404)
    const path = url.pathname.slice(4)
    const method = event.method
    const data = event.data ?? {}
    const client = context.OPENID || context.CLIENTIP || event.gatewayIp || 'gateway'
    await limit(`all:${client}`, 120)
    if (path === '/health' && method === 'GET') return { status: 'ok', backend: 'wxcloud', demoEnabled: false }
    if (path === '/auth/dev') throw fail('体验登录在此环境中未启用', 403)
    if (path.startsWith('/auth/') || path.startsWith('/me/account')) await limit(`accounts:${client}`, 10)
    if (path === '/auth/register' || path === '/auth/login' || path === '/me/account/password'
      || path === '/me/account' && method !== 'GET') throw fail('仅支持微信直接注册和登录', 403)
    if (path === '/auth/wechat' && method === 'POST') {
      // Neither event.openid, userId nor a browser supplied code is an identity.
      if (!context.OPENID || context.APPID !== appId) throw fail('请在对应微信小程序中登录', 401)
      const identity = `wx:${context.OPENID}`
      const user = await db.transaction(async tx => {
        const existing = await tx.get('identities', digest(identity))
        if (existing) {
          const user = await tx.get('users', existing.userId)
          if (!user || user.identity !== identity) throw new Error('Identity refers to missing or mismatched user')
          return user
        }
        const user = await createUser(tx, identity)
        await tx.set('identities', digest(identity), { userId: user.id })
        return user
      })
      return login(user)
    }
    const protectedRoute = path.startsWith('/me/') || path === '/favorites' || path.startsWith('/media/') && method === 'POST'
      || path === '/auth/logout' || /\/favorite$/.test(path)
    const user = protectedRoute ? await auth(event.token) : event.token ? await auth(event.token) : null
    if (path === '/auth/logout' && method === 'POST') {
      await db.remove('sessions', digest(event.token))
      return { loggedOut: true }
    }
    if (path === '/me/account' && method === 'GET') return profile(user)
    if (path === '/me/card' && method === 'GET') return cardData(await own(user), true)
    if (path === '/me/card' && method === 'PUT') {
      const basicOnly = url.searchParams.has('mode') && z.literal('basic').parse(url.searchParams.get('mode')) === 'basic'
      const basicInput = basicOnly || !membershipProfile(user, clock()).isVip
      const body = cardSchema.parse(basicInput ? prepareFreeInput(data) : data)
      if (basicInput) assertFreeCard(body)
      await ownedMedia(body, user)
      const card = await db.transaction(async tx => {
        const currentUser = await auth(event.token, tx)
        const card = await tx.get('cards', currentUser.cardId)
        if (!card || card.ownerId !== currentUser.id) throw fail('名片不存在', 404)
        const isVip = membershipProfile(currentUser, clock()).isVip
        if (basicOnly || !isVip) assertFreeCard(body)
        const updated = { ...card, body: basicOnly || !isVip ? mergeBasicFields(card.body, body) : body, updatedAt: now() }
        await tx.set('cards', card.id, updated)
        return updated
      })
      return cardData(card, true)
    }
    if (path === '/me/messages' && method === 'GET') {
      requireVip(user, clock())
      const { page, pageSize } = pagination.parse(Object.fromEntries(url.searchParams))
      const where = { cardId: user.cardId }
      const total = await db.count('messages', where)
      const items = (await db.list('messages', where, { skip: (page - 1) * pageSize, limit: pageSize, order: [['createdAt', 'desc']] }))
        .map(({ cardId, ...message }) => message)
      return { items, total, page, pageSize }
    }
    if (path === '/favorites' && method === 'GET') {
      const { page, pageSize, search } = pagination.parse({ pageSize: 20, ...Object.fromEntries(url.searchParams) })
      const { cards: all, unavailableIds } = await favorites(user, search)
      const items = await Promise.all(all.slice((page - 1) * pageSize, page * pageSize).map(async row => ({ ...await cardData(row.card), savedAt: row.savedAt })))
      return { items, total: all.length, page, pageSize, unavailableIds }
    }
    if (path === '/me/stats' && method === 'GET') {
      requireVip(user, clock())
      const where = { cardId: user.cardId }
      const today = chinaDay(new Date(clock()))
      const days = await Promise.all(Array.from({ length: 7 }, async (_, index) => {
        const day = chinaDay(new Date(clock() - (6 - index) * 86400000))
        return { day, views: await db.count('views', { ...where, day }) }
      }))
      return { views: await db.count('views', where), todayViews: await db.count('views', { ...where, day: today }),
        favorites: await db.count('favorites', where), contacts: (await favorites(user)).cards.length, days }
    }
    if (path === '/media/reserve' && method === 'POST') {
      requireVip(user, clock())
      const id = newId()
      const cloudPath = `staging/${context.OPENID || `gateway-${user.id}`}/${id}`
      await db.transaction(async tx => {
        requireVip(await auth(event.token, tx), clock())
        await tx.set('uploads', id, { id, ownerId: user.id, cloudPath, env: context.ENV || envId,
          expiresAt: clock() + 1800000, expiresOn: new Date(clock() + 1800000) })
      })
      return { id, cloudPath }
    }
    if (path === '/media/commit' && method === 'POST') {
      requireVip(user, clock())
      await limit(`uploads:${user.id}`, 20)
      const body = z.object({ id: z.string().regex(/^[a-f\d]{24}$/), fileID: z.string().max(2000) }).strict().parse(data)
      const reservation = await db.get('uploads', body.id)
      if (!reservation || reservation.ownerId !== user.id || reservation.expiresAt <= clock()) throw fail('上传凭证已过期或不属于当前账号')
      const cloudEnv = reservation.env || context.ENV || envId
      if (!cloudEnv || !body.fileID.startsWith(`cloud://${cloudEnv}.`) || !body.fileID.endsWith(`/${reservation.cloudPath}`)) throw fail('上传文件地址不正确')
      // Validate a snapshot, then publish a server-owned immutable copy. Clients
      // cannot replace the validated file through their upload permissions.
      let buffer, metadata
      try {
        buffer = await storage.download(body.fileID)
        metadata = await inspectFile(buffer)
      }
      catch (error) { await storage.remove(body.fileID).catch(() => {}); throw error }
      const fileID = await storage.upload(`media/${user.id}/${newId()}.${metadata.ext}`, buffer)
      try {
        await db.transaction(async tx => {
          requireVip(await auth(event.token, tx), clock())
          const current = await tx.get('uploads', body.id)
          if (!current || current.ownerId !== user.id || current.expiresAt <= clock()) throw fail('上传凭证已使用或已过期', 409)
          await tx.set('media', body.id, { id: body.id, ownerId: user.id, fileID, ...metadata, createdAt: now() })
          await tx.remove('uploads', body.id)
        })
      }
      catch (error) { await storage.remove(fileID).catch(() => {}); throw error }
      await storage.remove(body.fileID).catch(error => logger.error('Staging cleanup failed', { message: error.message }))
      const uploaded = { url: `/api/media/${body.id}`, kind: metadata.kind, size: metadata.size }
      try {
        const previewUrl = (await storage.urls([fileID]))[fileID]
        if (!previewUrl) throw new Error('Cloud storage URL missing')
        return { ...uploaded, previewUrl }
      }
      catch (error) {
        // The immutable file and its owner record are already committed. Keep
        // the durable reference so the editor can save it and refresh its
        // authorized preview later instead of uploading a duplicate file.
        logger.error('Uploaded media preview failed', { mediaId: body.id, message: error.message })
        return { ...uploaded, mediaUnavailable: true }
      }
    }
    const media = /^\/media\/([a-f\d]{24})$/.exec(path)
    if (media && method === 'GET') {
      const record = await db.get('media', media[1])
      if (!record) throw fail('媒体不存在', 404)
      const owner = await db.get('users', record.ownerId)
      const card = owner ? await db.get('cards', owner.cardId) : null
      const effectiveBody = card && projectCardBody(card.body, owner, clock())
      if (!membershipProfile(owner, clock()).isVip
        || record.ownerId !== user?.id && (!effectiveBody?.published || !sources(effectiveBody, true).includes(`/api/media/${record.id}`)))
        throw fail('媒体不存在或未公开', 404)
      return { url: (await storage.urls([record.fileID]))[record.fileID] }
    }
    const match = /^\/cards\/([^/]+)(?:\/(messages|favorite|qr))?$/.exec(path)
    if (match) {
      const id = idSchema.parse(match[1])
      const action = match[2]
      if (action === 'favorite' && method === 'DELETE') {
        await db.transaction(async tx => {
          const currentUser = await auth(event.token, tx)
          const key = favoriteKey(currentUser, id)
          if (!await tx.get('favorites', key)) return
          await tx.set('users', currentUser.id, { ...currentUser, favoriteRevision: newId() })
          await tx.remove('favorites', key)
        })
        return { saved: false }
      }
      const card = await visible(id, user)
      if (!action && method === 'GET') {
        if (card.ownerId !== user?.id) {
          const day = chinaDay(new Date(clock()))
          const owner = await db.get('users', card.ownerId)
          const visitor = digest(`${owner.analyticsSalt || owner.id}:${user?.id || client}`)
          const key = digest(`${id}:${visitor}:${day}`)
          await db.transaction(async tx => {
            if (!await tx.get('views', key)) await tx.set('views', key, { cardId: id, visitor, day, createdAt: now() })
          })
        }
        return { ...await cardData(card, card.ownerId === user?.id), isOwner: card.ownerId === user?.id,
          isFavorite: user ? !!await db.get('favorites', favoriteKey(user, id)) : false }
      }
      if (action === 'messages' && method === 'POST') {
        if (!card.body.published) throw fail('名片不存在或已设为私密', 404)
        requireVip(await db.get('users', card.ownerId), clock())
        await limit(`messages:${client}`, 5)
        const body = z.object({ name: text(30).min(1, '请填写你的称呼'), contact: text(120).default(''), content: text(1000).min(1, '请填写留言内容') }).strict().parse(data)
        const messageId = newId()
        await db.transaction(async tx => {
          requireVip(await tx.get('users', card.ownerId), clock())
          const currentCard = await tx.get('cards', id)
          if (!currentCard?.body.published) throw fail('名片不存在或已设为私密', 404)
          await tx.set('messages', messageId, { id: messageId, cardId: id, ...body, createdAt: now() })
        })
        return { submitted: true }
      }
      if (action === 'favorite' && method === 'PUT') {
        if (card.ownerId === user.id) throw fail('无需收藏自己的名片')
        const key = favoriteKey(user, id)
        await db.transaction(async tx => {
          const currentUser = await auth(event.token, tx)
          if (await tx.get('favorites', key)) return
          // Cloud transactions support document operations only. Updating the
          // same user document for every add/remove serializes quota changes;
          // a conflict retries both the count and current membership check.
          await tx.set('users', currentUser.id, { ...currentUser, favoriteRevision: newId() })
          assertFavoriteCapacity(currentUser, await db.count('favorites', { userId: currentUser.id }), clock())
          await tx.set('favorites', key, { userId: currentUser.id, cardId: id, createdAt: now() })
        })
        return { saved: true }
      }
      if (action === 'qr' && method === 'GET') {
        if (!card.body.published) throw fail('请先将名片设为公开')
        await limit(`qr:${client}`, 15)
        const mode = z.enum(['web', 'wechat']).default('web').parse(url.searchParams.get('mode') || undefined)
        const shareUrl = `${webUrl.replace(/\/$/, '')}/#/pages/card/card?id=${id}`
        return { image: mode === 'wechat' ? await qr(id, envVersion) : await QRCode.toDataURL(shareUrl, { width: 430, margin: 2 }), url: shareUrl, mode }
      }
    }
    throw fail('接口不存在', 404)
  }
  return {
    async handle(input, context = {}) {
      try {
        // wx.cloud.callFunction injects these platform fields. They are never
        // identity inputs: use only the separate cloud.getWXContext() result.
        const request = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : input
        if (request && typeof request === 'object') {
          delete request.userInfo
          delete request.tcbContext
        }
        const event = envelope.parse(request)
        return ok(await route(event, context))
      }
      catch (error) {
        if (error instanceof ZodError) return { code: 400, message: error.issues[0]?.message || '请求参数不正确' }
        const conflict = isTransactionConflict(error)
        const status = error.statusCode || (conflict ? 503 : 500)
        if (status >= 500) logger.error('Cloud function failed', {
          path: input?.path, method: input?.method, code: error.code || error.errCode, message: error.message,
        })
        return { code: status, message: conflict ? '请求暂时繁忙，请稍后重试' : status >= 500 ? '云服务暂时不可用，请稍后重试' : error.message }
      }
    },
  }
}
