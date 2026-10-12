import { request } from '@/http'
import { parseAccount, parseLogout } from '@/http/validators'

export const accountApi = {
  mine: () => request('/me/account').then(parseAccount),
  logout: () => request('/auth/logout', 'POST', {}).then(parseLogout),
}
