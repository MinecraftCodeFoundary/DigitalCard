import { useSessionStore } from '@/store/session'
import { callCloud } from './cloud'
import { HttpError } from './errors'

export { HttpError } from './errors'
export function request<T>(
  path: string,
  method: UniApp.RequestOptions['method'] = 'GET',
  data?: unknown,
  authenticated = true,
): Promise<T> {
  const session = useSessionStore()
  const requestToken = session.token
  // #ifdef MP-WEIXIN
  if (import.meta.env.VITE_BACKEND_MODE === 'cloud') {
    return callCloud(path, method, data, authenticated ? requestToken : '').then((body) => {
      if (!body || typeof body !== 'object' || !('code' in body))
        throw new HttpError('云服务返回了无效数据', 502)
      if (body.code === 0 && 'data' in body)
        return body.data as T
      const status = typeof body.code === 'number' ? body.code : 502
      if (status === 401 && authenticated && session.token === requestToken)
        session.clearToken()
      throw new HttpError('message' in body && typeof body.message === 'string' ? body.message : '请求失败', status)
    })
  }
  // #endif
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${import.meta.env.VITE_SERVER_BASEURL.replace(/\/$/, '')}${path}`,
      method,
      data: data as UniApp.RequestOptions['data'],
      timeout: 12000,
      header:
        authenticated && session.token
          ? { Authorization: `Bearer ${session.token}` }
          : {},
      success(res) {
        const body = res.data
        if (!body || typeof body !== 'object' || !('code' in body)) {
          reject(new HttpError('服务返回了无效数据', res.statusCode))
          return
        }
        if (
          res.statusCode >= 200
          && res.statusCode < 300
          && body.code === 0
          && 'data' in body
        ) {
          resolve(body.data as T)
          return
        }
        if (res.statusCode === 401 && authenticated && session.token === requestToken)
          session.clearToken()
        reject(
          new HttpError(
            'message' in body && typeof body.message === 'string'
              ? body.message
              : '请求失败',
            res.statusCode,
          ),
        )
      },
      fail() {
        reject(new HttpError('无法连接服务，请检查网络或后端是否启动', 0))
      },
    })
  })
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试'
}
export function showError(error: unknown) {
  uni.showToast({ title: errorMessage(error), icon: 'none', duration: 3000 })
}
