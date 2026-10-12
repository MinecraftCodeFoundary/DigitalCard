import { HttpError } from './errors'

let initialized = false
export function initializeCloud() {
  // #ifdef MP-WEIXIN
  if (import.meta.env.VITE_BACKEND_MODE === 'cloud' && !initialized) {
    if (!wx.cloud)
      throw new HttpError('请升级微信后使用云服务', 503)
    wx.cloud.init({ env: import.meta.env.VITE_CLOUD_ENV, traceUser: true })
    initialized = true
  }
  // #endif
}
export async function callCloud(path: string, method: string, data: unknown, token: string): Promise<unknown> {
  // #ifdef MP-WEIXIN
  initializeCloud()
  try {
    const response = await wx.cloud.callFunction({ name: import.meta.env.VITE_CLOUD_FUNCTION, data: { path: `/api${path}`, method, ...(data === undefined ? {} : { data }), token } })
    return response.result
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    throw new HttpError('无法连接云服务，请确认云函数已部署到指定环境', 503)
  }
  // #endif
  // #ifndef MP-WEIXIN
  throw new HttpError('此平台请通过云网关访问', 503)
  // #endif
}
