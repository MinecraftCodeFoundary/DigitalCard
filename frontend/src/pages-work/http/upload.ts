import { HttpError, request } from '@/http'
import { initializeCloud } from '@/http/cloud'
import { parseMediaReservation } from '@/http/validators'
import { useSessionStore } from '@/store/session'

export function upload(path: string, filePath: string, onProgress: (progress: number) => void): Promise<unknown> {
  const session = useSessionStore()
  const requestToken = session.token
  // #ifdef MP-WEIXIN
  if (import.meta.env.VITE_BACKEND_MODE === 'cloud') {
    return (async () => {
      initializeCloud()
      const reservation = parseMediaReservation(await request('/media/reserve', 'POST', {}))
      const fileID = await new Promise<string>((resolve, reject) => {
        const task = wx.cloud.uploadFile({ cloudPath: reservation.cloudPath, filePath, success: result => resolve(result.fileID), fail: () => reject(new HttpError('云存储上传失败，请检查网络和存储权限', 503)) })
        task.onProgressUpdate(result => onProgress(result.progress))
      })
      if (session.token !== requestToken)
        throw new HttpError('登录状态已变化，请重新上传', 401)
      return request('/media/commit', 'POST', { id: reservation.id, fileID })
    })()
  }
  // #endif
  return new Promise((resolve, reject) => {
    const task = uni.uploadFile({
      url: `${import.meta.env.VITE_SERVER_BASEURL.replace(/\/$/, '')}${path}`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${session.token}` },
      timeout: 120000,
      success(result) {
        let body: unknown
        try {
          body = JSON.parse(result.data)
        }
        catch {
          reject(new HttpError('上传服务返回了无效数据', result.statusCode))
          return
        }
        if (result.statusCode === 401 && session.token === requestToken)
          session.clearToken()
        if (body && typeof body === 'object' && 'code' in body && body.code === 0 && 'data' in body && result.statusCode >= 200 && result.statusCode < 300) {
          resolve(body.data)
          return
        }
        reject(new HttpError(body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : '上传失败，请重试', result.statusCode))
      },
      fail() {
        reject(new HttpError('上传失败，请检查网络后重试', 0))
      },
    })
    task.onProgressUpdate(result => onProgress(result.progress))
  })
}
