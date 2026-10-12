export function createWechatClient({ appId, appSecret, envVersion = 'develop' }, fetcher = fetch) {
  let cachedToken
  let expiresAt = 0
  function configured() {
    if (!appId || !appSecret) {
      throw Object.assign(new Error('请先配置微信 AppID 和 AppSecret'), { statusCode: 503 })
    }
  }
  async function json(url, options) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw Object.assign(new Error('微信服务暂时不可用'), { statusCode: 502 })
    const data = await response.json()
    if (data.errcode) throw Object.assign(new Error('微信授权失败，请重试'), { statusCode: 502 })
    return data
  }
  async function accessToken() {
    if (cachedToken && Date.now() < expiresAt) return cachedToken
    const query = new URLSearchParams({ grant_type: 'client_credential', appid: appId, secret: appSecret })
    const data = await json(`https://api.weixin.qq.com/cgi-bin/token?${query}`)
    if (!data.access_token) throw Object.assign(new Error('微信凭证获取失败'), { statusCode: 502 })
    cachedToken = data.access_token
    expiresAt = Date.now() + Math.max(0, (data.expires_in - 300)) * 1000
    return cachedToken
  }
  return {
    async login(code) {
      configured()
      const query = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' })
      const data = await json(`https://api.weixin.qq.com/sns/jscode2session?${query}`)
      if (!data.openid) throw Object.assign(new Error('微信登录失败'), { statusCode: 502 })
      return data.openid
    },
    async qr(cardId) {
      configured()
      const token = await accessToken()
      const response = await fetcher(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scene: cardId, page: 'pages/card/card', width: 430, check_path: envVersion === 'release', env_version: envVersion }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok || response.headers.get('content-type')?.includes('json')) {
        cachedToken = undefined
        throw Object.assign(new Error('小程序码生成失败，请检查微信配置与版本'), { statusCode: 502 })
      }
      const mime = response.headers.get('content-type')?.includes('jpeg') ? 'image/jpeg' : 'image/png'
      return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`
    },
  }
}
