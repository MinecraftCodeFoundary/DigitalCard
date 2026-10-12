import { describe, expect, it } from 'vitest'
import { validateProductionGateway } from './production-gateway'

describe('production H5 gateway configuration', () => {
  it('supports a same-origin API and an explicit HTTPS gateway', () => {
    for (const value of ['/api', '/api/', 'https://cards.example.com/api', 'https://cards.example.com/service/api/'])
      expect(() => validateProductionGateway(value)).not.toThrow()
  })

  it('rejects local gateways and configurations that cannot form API URLs', () => {
    for (const value of [
      undefined,
      '',
      'api',
      '//cards.example.com/api',
      '/other',
      'http://cards.example.com/api',
      'http://localhost:3000/api',
      'https://localhost:3000/api',
      'https://preview.localhost/api',
      'https://localhost./api',
      'https://127.0.0.1/api',
      'https://127.1/api',
      'https://[::1]/api',
      'https://0.0.0.0/api',
      'https://name:password@cards.example.com/api',
      'https://cards.example.com',
      'https://cards.example.com/api?token=demo',
      'https://cards.example.com/api#fragment',
      ' https://cards.example.com/api ',
    ]) {
      expect(() => validateProductionGateway(value), String(value)).toThrow('VITE_SERVER_BASEURL')
    }
  })
})
