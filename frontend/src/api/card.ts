import type { CardBody, CardMessageBody } from './types'
import { request } from '@/http'
import {
  parseCard,
  parseFavorite,
  parseList,
  parseLogin,
  parseMessageList,
  parseMessageSubmission,
  parseQr,
  parseStats,
} from '@/http/validators'

export const cardApi = {
  demoLogin: (devKey?: string) =>
    request('/auth/dev', 'POST', devKey ? { devKey } : {}, false).then(
      parseLogin,
    ),
  wechatLogin: (code: string) =>
    request('/auth/wechat', 'POST', { code }, false).then(parseLogin),
  mine: () => request('/me/card').then(parseCard),
  messages: (page = 1) => request(`/me/messages?page=${page}&pageSize=10`).then(parseMessageList),
  leaveMessage: (id: string, body: CardMessageBody) =>
    request(`/cards/${encodeURIComponent(id)}/messages`, 'POST', body, false).then(parseMessageSubmission),
  save: (body: CardBody, options?: { basicOnly?: boolean }) =>
    request(options?.basicOnly ? '/me/card?mode=basic' : '/me/card', 'PUT', body).then(parseCard),
  detail: (id: string) =>
    request(`/cards/${encodeURIComponent(id)}`).then(parseCard),
  favorites: (page = 1, pageSize = 20, search = '') =>
    request(
      `/favorites?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`,
    ).then(parseList),
  favorite: (id: string, save: boolean) =>
    request(
      `/cards/${encodeURIComponent(id)}/favorite`,
      save ? 'PUT' : 'DELETE',
      {},
    ).then(parseFavorite),
  stats: () => request('/me/stats').then(parseStats),
  qr: (id: string, mode: 'web' | 'wechat') =>
    request(`/cards/${encodeURIComponent(id)}/qr?mode=${mode}`).then(parseQr),
}
