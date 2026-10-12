import multipart from '@fastify/multipart'
import { fileTypeFromFile } from 'file-type'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { newId } from './db.mjs'

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const videoTypes = new Set(['video/mp4', 'video/webm'])
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
export const localMediaId = url => /^\/api\/media\/([a-f\d]{24})$/.exec(url || '')?.[1]
export function sectionMedia(section, visibleOnly = false) {
  if (section.type === 'card') return (section.blocks || []).filter(block => !visibleOnly || block.visible).flatMap(block => sectionMedia(block))
  return section.type === 'image' ? section.images || [] : section.type === 'video' ? [section.url, section.poster].filter(Boolean) : []
}
function signature(id, owner, expiry, secret) {
  return createHmac('sha256', secret).update(`${id}:${owner}:${expiry}`).digest('hex')
}
function previewUrl(row, secret) {
  const expiry = Math.floor(Date.now() / 1000) + 86400
  return `/api/media/${row.id}?preview=${expiry}.${signature(row.id, row.owner_id, expiry, secret)}`
}
export function mediaAccess(card, ownerId, secret) {
  const access = {}
  for (const url of [...(card.sections || []).flatMap(section => sectionMedia(section)), card.appearance?.coverImage, card.appearance?.brandLogo].filter(Boolean)) {
    const id = localMediaId(url)
    if (id) access[url] = previewUrl({ id, owner_id: ownerId }, secret)
  }
  return access
}
export function checkOwnedMedia(db, sections, ownerId, coverImage, brandLogo) {
  const sources = [...sections, { type: 'image', images: [coverImage, brandLogo].filter(Boolean) }]
  for (const section of sources.flatMap(section => section.type === 'card' ? section.blocks || [] : [section])) {
    for (const url of sectionMedia(section)) {
      const id = localMediaId(url)
      if (!id) continue
      const row = db.prepare('SELECT * FROM media WHERE id = ? AND owner_id = ?').get(id, ownerId)
      if (!row) throw error('上传的媒体不存在或不属于当前账号')
      const expectsVideo = section.type === 'video' && url === section.url
      if (expectsVideo ? !videoTypes.has(row.mime) : !imageTypes.has(row.mime)) throw error('媒体类型与模块不匹配')
    }
  }
}

export async function registerMediaRoutes(app, { db, auth, secret, directory }) {
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 1 } })
  app.post('/api/media', { preHandler: auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async request => {
    const file = await request.file()
    if (!file) throw error('请选择要上传的图片或视频')
    const id = newId()
    await mkdir(directory, { recursive: true })
    const temporary = join(directory, `${id}.upload`)
    let destination
    try {
      await pipeline(file.file, createWriteStream(temporary, { flags: 'wx' }))
      if (file.file.truncated) throw error('视频最大 50 MB，图片最大 8 MB', 413)
      const type = await fileTypeFromFile(temporary).catch(() => undefined)
      const size = (await stat(temporary)).size
      if (!type || !imageTypes.has(type.mime) && !videoTypes.has(type.mime)) throw error('支持 JPG、PNG、WebP、GIF 图片及 MP4、WebM 视频')
      if (imageTypes.has(type.mime) && size > 8 * 1024 * 1024) throw error('每张图片最大 8 MB', 413)
      const filename = `${id}.${type.ext}`
      destination = join(directory, filename)
      await rename(temporary, destination)
      db.prepare('INSERT INTO media VALUES (?, ?, ?, ?, ?, ?)').run(id, request.user.sub, filename, type.mime, size, new Date().toISOString())
      return { code: 0, data: { url: `/api/media/${id}`, previewUrl: previewUrl({ id, owner_id: request.user.sub }, secret),
        kind: imageTypes.has(type.mime) ? 'image' : 'video', size } }
    }
    catch (e) {
      await unlink(temporary).catch(() => {})
      if (destination) await unlink(destination).catch(() => {})
      throw e
    }
  })
  app.get('/api/media/:id', async (request, reply) => {
    if (!/^[a-f\d]{24}$/.test(request.params.id)) throw error('媒体不存在', 404)
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(request.params.id)
    if (!row) throw error('媒体不存在', 404)
    const preview = typeof request.query.preview === 'string' ? /^(\d{10})\.([a-f\d]{64})$/.exec(request.query.preview) : null
    const validPreview = preview && Number(preview[1]) > Date.now() / 1000
      && timingSafeEqual(Buffer.from(preview[2], 'hex'), Buffer.from(signature(row.id, row.owner_id, preview[1], secret), 'hex'))
    const ownerCard = db.prepare('SELECT body FROM cards WHERE owner_id = ?').get(row.owner_id)
    const card = ownerCard ? JSON.parse(ownerCard.body) : null
    const url = `/api/media/${row.id}`
    const publiclyVisible = card?.published && ((['portrait', 'poster'].includes(card.appearance?.layout) && card.appearance.coverImage === url)
      || (card.appearance?.layout === 'poster' && card.appearance.brandLogo === url)
      || (card.sections || []).some(section => section.visible && sectionMedia(section, true).includes(url)))
    if (!validPreview && !publiclyVisible) throw error('媒体不存在或未公开', 404)
    reply.header('Content-Type', row.mime).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store').header('Accept-Ranges', 'bytes')
    let start = 0; let end = row.size - 1
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
      if (!range || !range[1] && !range[2]) return reply.code(416).header('Content-Range', `bytes */${row.size}`).send()
      start = range[1] ? Number(range[1]) : Math.max(0, row.size - Number(range[2]))
      end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= row.size) return reply.code(416).header('Content-Range', `bytes */${row.size}`).send()
      reply.code(206).header('Content-Range', `bytes ${start}-${end}/${row.size}`)
    }
    const path = join(directory, row.filename)
    await stat(path).catch(() => { throw error('媒体文件不存在', 404) })
    return reply.header('Content-Length', end - start + 1).send(createReadStream(path, { start, end }))
  })
}
