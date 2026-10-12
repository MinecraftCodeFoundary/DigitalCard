const cloud = require('wx-server-sdk')
// Initialize once, independently of the mini program. Never cache WXContext.
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
let service
exports.main = async (event) => {
  service ||= Promise.all([import('./service.mjs'), import('./repository.mjs'), import('./storage.mjs')])
    .then(([{ createService }, { CloudRepository }, { CloudStorage }]) => createService({
      repository: new CloudRepository(cloud.database()),
      storage: new CloudStorage(cloud),
      appId: process.env.WECHAT_APP_ID || 'wx0ea087f9c508f86f',
      envId: process.env.TCB_ENV || 'cloud1-d5g9aguo13adf0f36',
      webUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:9000',
      envVersion: process.env.WECHAT_ENV_VERSION || 'develop',
      qr: async (id, envVersion) => {
        const result = await cloud.openapi.wxacode.getUnlimited({
          scene: id, page: 'pages/card/card', width: 430,
          checkPath: envVersion === 'release', envVersion,
        })
        return `data:image/png;base64,${result.buffer.toString('base64')}`
      },
    }))
  const context = cloud.getWXContext()
  return (await service).handle(event, context)
}
