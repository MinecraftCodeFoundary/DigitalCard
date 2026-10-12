import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'

// H5 is a transport gateway. All business data and authorization live in the
// same cloud function used by the mini program; no local SQLite fallback.
export async function buildGateway({ cloud, functionName = 'digitalCard', logger = false,
  corsOrigins = 'http://localhost:9000,http://127.0.0.1:9000' } = {}) {
  const app = Fastify({ logger, bodyLimit: 200000 })
  await app.register(cors, { origin: corsOrigins.split(','), methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] })
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0, parts: 1 } })
  async function call(request, path = request.url, method = request.method === 'HEAD' ? 'GET' : request.method, data = request.body) {
    if (!cloud) return { code: 503, message: 'H5 云网关尚未配置服务端凭证，请在微信开发者工具中测试小程序，或按部署文档配置网关' }
    const result = await cloud.callFunction({ name: functionName,
      data: { path, method, ...(data !== undefined ? { data } : {}),
        token: request.headers.authorization?.replace(/^Bearer /, '') || '', gatewayIp: request.ip } })
    const body = typeof result.result === 'string' ? JSON.parse(result.result) : result.result
    if (!body || !Number.isInteger(body.code)) throw new Error('Invalid cloud response')
    return body
  }
  app.setErrorHandler((error, request, reply) => {
    const code = error.statusCode || 502
    if (code >= 500) request.log.error({ message: error.message }, 'cloud gateway failed')
    reply.code(code).send({ code, message: code >= 500 ? '无法连接云服务，请检查网关配置' : error.message })
  })
  app.post('/api/media', async (request, reply) => {
    const reservation = await call(request, '/api/media/reserve', 'POST', {})
    if (reservation.code) return reply.code(reservation.code).send(reservation)
    const file = await request.file()
    if (!file) return reply.code(400).send({ code: 400, message: '请选择图片或视频' })
    const buffer = await file.toBuffer()
    if (file.file.truncated) return reply.code(413).send({ code: 413, message: '文件最大 50 MB' })
    const uploaded = await cloud.uploadFile({ cloudPath: reservation.data.cloudPath, fileContent: buffer })
    let body
    try { body = await call(request, '/api/media/commit', 'POST', { id: reservation.data.id, fileID: uploaded.fileID }) }
    finally { await cloud.deleteFile({ fileList: [uploaded.fileID] }).catch(() => {}) }
    return reply.code(body.code || 200).send(body)
  })
  app.route({ method: ['GET', 'POST', 'PUT', 'DELETE'], url: '/api/*', handler: async (request, reply) => {
    const body = await call(request)
    if (body.code) return reply.code(body.code).send(body)
    if (/^\/api\/media\/[a-f\d]{24}(?:\?|$)/.test(request.url) && ['GET', 'HEAD'].includes(request.method))
      return reply.header('Cache-Control', 'private, no-store').redirect(body.data.url)
    return body
  } })
  return app
}
