export function validateProductionGateway(baseUrl: string | undefined) {
  if (baseUrl === '/api' || baseUrl === '/api/')
    return

  let gateway: URL | undefined
  try {
    gateway = new URL(baseUrl ?? '')
  }
  catch {}

  const hostname = gateway?.hostname.toLowerCase().replace(/\.$/, '')
  if (gateway && baseUrl === baseUrl?.trim()
    && gateway.protocol === 'https:' && !gateway.username && !gateway.password
    && !gateway.search && !gateway.hash && /\/api\/?$/.test(gateway.pathname)
    && hostname !== 'localhost' && !hostname?.endsWith('.localhost')
    && hostname !== '[::1]' && hostname !== '0.0.0.0' && !hostname?.startsWith('127.')) {
    return
  }

  throw new Error('H5 生产构建的 VITE_SERVER_BASEURL 必须为 /api（同域网关）或非本机地址的 HTTPS /api 地址。请检查 frontend/env/.env.production.local；不能使用 localhost。')
}
