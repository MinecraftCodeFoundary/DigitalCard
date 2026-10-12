import { fileTypeFromBuffer } from 'file-type'
import { fail } from './schema.mjs'
export const mediaId = url => /^\/api\/media\/([a-f\d]{24})$/.exec(url || '')?.[1]
export function sectionMedia(section, visible = false) {
  if (section.type === 'card') return (section.blocks || []).filter(block => !visible || block.visible).flatMap(block => sectionMedia(block))
  return section.type === 'image' ? section.images || [] : section.type === 'video' ? [section.url, section.poster].filter(Boolean) : []
}
export function sources(card, visible = false) {
  const sections = (card.sections || []).filter(section => !visible || section.visible)
  const style = card.appearance || {}
  return [...sections.flatMap(section => sectionMedia(section, visible)),
    ...(!visible || ['portrait', 'poster'].includes(style.layout) ? [style.coverImage] : []),
    ...(!visible || style.layout === 'poster' ? [style.brandLogo] : [])].filter(Boolean)
}
export async function inspectFile(buffer) {
  const type = await fileTypeFromBuffer(buffer).catch(() => undefined)
  const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type?.mime)
  const video = ['video/mp4', 'video/webm'].includes(type?.mime)
  if (!image && !video) throw fail('支持 JPG、PNG、WebP、GIF 图片及 MP4、WebM 视频')
  if (buffer.length > (image ? 8 : 50) * 1024 * 1024) throw fail('图片最大 8 MB，视频最大 50 MB', 413)
  return { mime: type.mime, ext: type.ext, kind: image ? 'image' : 'video', size: buffer.length }
}
export class CloudStorage {
  constructor(cloud) { this.cloud = cloud }
  async upload(path, buffer) { return (await this.cloud.uploadFile({ cloudPath: path, fileContent: buffer })).fileID }
  async download(fileID) {
    // Bound the stream, not just the eventual Buffer: a malicious direct upload
    // must not exhaust the function's memory before file validation can run.
    const url = (await this.urls([fileID]))[fileID]
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!response.ok || !response.body) throw new Error('Cloud file download failed')
    const max = 50 * 1024 * 1024
    if (Number(response.headers.get('content-length')) > max) {
      await response.body.cancel()
      throw fail('文件最大 50 MB', 413)
    }
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > max) throw fail('文件最大 50 MB', 413)
      chunks.push(chunk)
    }
    return Buffer.concat(chunks, size)
  }
  async remove(fileID) {
    const result = await this.cloud.deleteFile({ fileList: [fileID] })
    if (result.fileList?.some(file => file.status !== 0)) throw new Error('Cloud storage cleanup failed')
  }
  async urls(fileIDs) {
    const urls = {}
    for (let offset = 0; offset < fileIDs.length; offset += 50) {
      const result = await this.cloud.getTempFileURL({ fileList: fileIDs.slice(offset, offset + 50).map(fileID => ({ fileID, maxAge: 300 })) })
      for (const file of result.fileList) {
        if (file.status !== 0 || !file.tempFileURL?.startsWith('https://')) throw new Error('Cloud storage URL failed')
        urls[file.fileID] = file.tempFileURL
      }
    }
    return urls
  }
}
