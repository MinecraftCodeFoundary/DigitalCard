import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { openContinuousEditor } from '../e2e/helpers/editor'

const api = 'http://127.0.0.1:3200'
type Plan = 'free' | 'vip' | 'expired'
interface Session {
  token: string
  expiresIn: number
  account: { id: string, membership: { plan: string, isVip: boolean } }
  card: Record<string, any>
}
async function session(request: APIRequestContext, plan: Plan = 'free'): Promise<Session> {
  const response = await request.post(`${api}/__test/session`, { data: { plan } })
  expect(response.ok()).toBe(true)
  return response.json()
}
async function membership(request: APIRequestContext, user: Session, plan: Plan) {
  const response = await request.post(`${api}/__test/membership`, { data: { token: user.token, plan } })
  expect(response.ok()).toBe(true)
}
function headers(user: Session) { return { authorization: `Bearer ${user.token}` } }
function body(card: Record<string, any>) {
  const { id, updatedAt, mediaAccess, mediaUnavailable, isVip, isOwner, isFavorite, savedAt, ...editable } = card
  return editable
}
async function save(request: APIRequestContext, user: Session, patch: Record<string, any> = {}) {
  const response = await request.put(`${api}/api/me/card`, {
    headers: headers(user), data: { ...body(user.card), name: '会员测试名片', published: true, ...patch },
  })
  expect(response.status(), await response.text()).toBe(200)
  user.card = (await response.json()).data
}
async function signIn(page: Page, user: Session, path = '/') {
  await page.addInitScript(({ token, expiresIn }) => {
    localStorage.setItem('digital-card-session', JSON.stringify({
      token, devKey: '', mode: 'wechat', expiresAt: Date.now() + expiresIn * 1000, autoLoginDisabled: false,
    }))
  }, user)
  await page.goto(path)
}
function field(page: Page, label: string | RegExp) {
  return page.locator('.field').filter({ has: page.getByText(label, { exact: true }) }).locator('input')
}
async function publishedCard(request: APIRequestContext, name: string, patch: Record<string, any> = {}) {
  const owner = await session(request)
  await save(request, owner, { name, ...patch })
  return owner.card
}
async function seedFavorites(request: APIRequestContext, user: Session, count: number, prefix: string) {
  const response = await request.post(`${api}/__test/favorites`, { data: { token: user.token, count, prefix } })
  expect(response.status(), await response.text()).toBe(200)
  expect((await response.json()).created).toBe(count)
}
async function openCard(page: Page, card: Record<string, any>) {
  // Exercise a fresh shared link: a hash-only goto can reuse Uni-app's previous
  // detail page and leave its onLoad card ID unchanged.
  await page.goto('about:blank')
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().endsWith(`/api/cards/${card.id}`)
      && item.request().method() === 'GET', { timeout: 15000 }),
    page.goto(`/#/pages/card/card?id=${card.id}`),
  ])
  expect(response.status()).toBe(200)
  await expect(page.getByText(card.name, { exact: true })).toBeVisible()
}
async function favoriteThroughPage(page: Page, cardId: string, expectedStatus = 200) {
  const button = page.getByRole('button', { name: '收藏这张名片', exact: true })
  await expect(button).toBeVisible()
  const [response] = await Promise.all([
    page.waitForResponse(item => item.url().endsWith(`/api/cards/${cardId}/favorite`)
      && item.request().method() === 'PUT', { timeout: 15000 }),
    button.click(),
  ])
  expect(response.status()).toBe(expectedStatus)
}
async function searchWallet(page: Page, query: string) {
  await page.locator('.search-box input').fill(query)
  const response = page.waitForResponse(item => {
    const url = new URL(item.url())
    return url.pathname === '/api/favorites' && url.searchParams.get('search') === query
  })
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  expect((await response).status()).toBe(200)
}

test('account identifies free membership, copies its ID and refreshes manual grants and expiry', async ({ page, request, context }) => {
  const user = await session(request)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signIn(page, user, '/#/pages-work/account/account')
  await expect(page.getByText('免费版', { exact: true })).toBeVisible()
  await expect(page.getByText(user.account.id, { exact: true })).toBeVisible()
  await expect(page.getByText('如需开通或续期，请将账号编号提供给管理员。开通后点击下方按钮刷新状态。')).toBeVisible()
  await page.getByRole('button', { name: '复制账号编号', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(user.account.id)
  await membership(request, user, 'vip')
  await page.getByRole('button', { name: '刷新会员状态', exact: true }).click()
  await expect(page.getByText('VIP 会员', { exact: true })).toBeVisible()
  await expect(page.getByText('全部功能已解锁', { exact: true })).toBeVisible()
  await membership(request, user, 'expired')
  await page.getByRole('button', { name: '刷新会员状态', exact: true }).click()
  await expect(page.getByText('VIP 已到期', { exact: true })).toBeVisible()
  await expect(page.getByText('基础简易名片', { exact: true })).toBeVisible()
  await expect(page.getByText('内容已复制', { exact: true })).toBeHidden()
  await page.screenshot({ path: 'artifacts/vip-account-expired-mobile.png', fullPage: true })
})

test('free members can edit and share a basic card and open their wallet while advanced editing and stats stay gated', async ({ page, request, browser }) => {
  const user = await session(request)
  await save(request, user)
  const premiumReads: string[] = []
  page.on('request', item => {
    if (/\/api\/me\/(?:stats|messages)(?:\?|$)/.test(item.url())) premiumReads.push(item.url())
  })
  await signIn(page, user)
  await expect(page.locator('.identity-card')).toHaveClass(/minimal/)
  await expect(page.locator('.message-board')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await expect(page.getByTestId('free-card-notice')).toBeVisible()
  await openContinuousEditor(page)
  await expect(page.locator('.module-editor')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '页面与排版设置', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '＋ 添加文字段落', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /调整样式细节/ })).toHaveCount(0)
  await field(page, /^姓名\s*\*$/).fill('免费会员的名片')
  await field(page, '联系电话').fill('13800000000')
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByText('免费会员的名片', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '分享名片', exact: true }).click()
  await expect(page.locator('.qr-image img')).toHaveAttribute('src', /^data:image\/png;base64/)
  const visitor = await browser.newPage()
  try {
    await visitor.goto(`http://localhost:9200/#/pages/card/card?id=${user.card.id}`)
    await expect(visitor.getByText('13800000000', { exact: true })).toBeVisible()
    await expect(visitor.locator('.identity-card')).toHaveClass(/minimal/)
    await expect(visitor.locator('.message-board')).toHaveCount(0)
  }
  finally { await visitor.close() }
  await page.goto('/#/pages/stats/stats')
  await expect(page.getByText('数据概览 · VIP 专属', { exact: true })).toBeVisible()
  await expect(page.locator('.stat-grid')).toHaveCount(0)
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.getByText('普通用户最多收藏 10 张名片，VIP 最多 50 张。', { exact: true })).toBeVisible()
  await expect(page.locator('.search-box')).toBeVisible()
  expect(premiumReads).toEqual([])
  await page.screenshot({ path: 'artifacts/vip-free-wallet-mobile.png', fullPage: true })
})

test('cloud authorization rejects premium API bypasses for free and expired members', async ({ request }) => {
  for (const plan of ['free', 'expired'] as const) {
    const user = await session(request, plan)
    await save(request, user)
    expect(user.card.isVip).toBe(false)
    for (const [method, path, data] of [
      ['GET', '/me/stats', undefined],
      ['GET', '/me/messages', undefined],
      ['POST', '/media/reserve', {}],
      ['PUT', '/me/card', { ...body(user.card), appearance: { ...user.card.appearance, layout: 'centered' } }],
      ['POST', `/cards/${user.card.id}/messages`, { name: '访客', content: '试图绕过留言限制' }],
    ] as const) {
      const response = await request.fetch(`${api}/api${path}`, { method, headers: headers(user), data })
      expect(response.status(), `${plan}: ${method} ${path}: ${await response.text()}`).toBe(403)
    }
  }
})

test('VIP can edit advanced layouts and content, use analytics and wallet, and receive visitor messages', async ({ page, request, browser }) => {
  const user = await session(request, 'vip')
  await save(request, user)
  await signIn(page, user)
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await expect(page.getByTestId('free-card-notice')).toHaveCount(0)
  await openContinuousEditor(page, { appearance: true })
  await page.getByRole('button', { name: '居中名片', exact: false }).click()
  await page.getByRole('button', { name: '＋ 添加文字段落', exact: true }).click()
  const row = page.locator('.module-row').last()
  await row.locator('input').fill('VIP 专属服务')
  await row.locator('textarea').fill('设计咨询与品牌合作')
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享名片', exact: true })).toBeVisible()
  await expect(page.locator('.identity-card')).toHaveClass(/centered/)
  await expect(page.getByText('设计咨询与品牌合作', { exact: true })).toBeVisible()
  await expect(page.locator('.message-board')).toBeVisible()
  const visitor = await browser.newPage()
  try {
    await visitor.goto(`http://localhost:9200/#/pages/card/card?id=${user.card.id}`)
    const board = visitor.locator('.message-board')
    await board.locator('.message-name-input input').fill('合作访客')
    await board.locator('textarea').fill('希望进一步了解 VIP 服务')
    await board.getByRole('button', { name: '发送留言', exact: true }).click()
    await expect(board.getByText('留言已送达', { exact: true })).toBeVisible()
  }
  finally { await visitor.close() }
  await page.getByRole('button', { name: '刷新留言', exact: true }).click()
  await expect(page.locator('.message-name')).toHaveText('合作访客')
  await page.getByRole('button', { name: '数据概览', exact: true }).click()
  await expect(page.getByText('近 7 天的连接足迹', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '名片夹', exact: true }).click()
  await expect(page.locator('.search-box')).toBeVisible()
  await expect(page.getByText('VIP 最多收藏 50 张名片。', { exact: true })).toBeVisible()
})

test('free members can collect and search cards, see the 10-card limit and remove unavailable favorites to make room', async ({ page, request }) => {
  const user = await session(request)
  const photographerOwner = await session(request)
  await save(request, photographerOwner, { name: '摄影合作伙伴', company: '一束光工作室', tags: ['摄影'] })
  const photographer = photographerOwner.card
  await signIn(page, user, `/#/pages/card/card?id=${photographer.id}`)
  await favoriteThroughPage(page, photographer.id)
  await expect(page.getByRole('button', { name: '已收藏 · 点击取消', exact: true })).toBeVisible()
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.getByText('普通用户最多收藏 10 张名片，VIP 最多 50 张。', { exact: true })).toBeVisible()
  await expect(page.locator('.contact-card')).toHaveCount(1)
  await searchWallet(page, '一束光')
  await expect(page.locator('.contact-name')).toHaveText('摄影合作伙伴')
  await searchWallet(page, '不存在的合作伙伴')
  await expect(page.locator('.contact-card')).toHaveCount(0)

  await seedFavorites(request, user, 9, '普通用户收藏')
  await page.reload()
  await expect(page.locator('.count')).toHaveText('10')
  const overflow = await publishedCard(request, '第十一张名片')
  await openCard(page, overflow)
  await favoriteThroughPage(page, overflow.id, 403)
  await expect(page.getByText('普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '收藏这张名片', exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/pages/card/card\\?id=${overflow.id}$`))
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.locator('.count')).toHaveText('10')

  await save(request, photographerOwner, { name: photographer.name, published: false })
  await page.reload()
  await expect(page.locator('.count')).toHaveText('9')
  await expect(page.getByText('摄影合作伙伴', { exact: true })).toHaveCount(0)
  await expect(page.getByText('另有 1 张名片暂不可用，仍占收藏名额。', { exact: true })).toBeVisible()
  await expect(page.locator('.unavailable-contact')).toHaveCount(1)
  await page.locator('.unavailable-contact').getByRole('button', { name: '取消收藏', exact: true }).click()
  await expect(page.locator('.unavailable-contact')).toHaveCount(0)
  await openCard(page, overflow)
  await favoriteThroughPage(page, overflow.id)
  await expect(page.getByRole('button', { name: '已收藏 · 点击取消', exact: true })).toBeVisible()
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.locator('.count')).toHaveText('10')
})

test('VIP can collect 50 cards and keep viewing, searching and removing favorites after expiry', async ({ page, request }) => {
  test.setTimeout(90000)
  const user = await session(request, 'vip')
  await seedFavorites(request, user, 49, 'VIP 收藏')
  const last = await publishedCard(request, '第五十位合作伙伴')
  await signIn(page, user, `/#/pages/card/card?id=${last.id}`)
  await favoriteThroughPage(page, last.id)
  await expect(page.getByRole('button', { name: '已收藏 · 点击取消', exact: true })).toBeVisible()
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.getByText('VIP 最多收藏 50 张名片。', { exact: true })).toBeVisible()
  await expect(page.locator('.count')).toHaveText('50')
  const overflow = await publishedCard(request, 'VIP 容量之外的新名片')
  await openCard(page, overflow)
  await favoriteThroughPage(page, overflow.id, 403)
  await expect(page.getByText('VIP 名片夹最多收藏 50 张名片，请先移除部分收藏', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '收藏这张名片', exact: true })).toBeVisible()

  await membership(request, user, 'expired')
  await page.goto('/#/pages/contacts/contacts')
  await expect(page.getByText('普通用户最多收藏 10 张名片，VIP 最多 50 张。', { exact: true })).toBeVisible()
  await expect(page.locator('.count')).toHaveText('50')
  await searchWallet(page, '第五十位')
  await expect(page.locator('.contact-card')).toHaveCount(1)
  await page.locator('.contact-card').click()
  await expect(page.getByText('第五十位合作伙伴', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '已收藏 · 点击取消', exact: true }).click()
  await expect(page.getByRole('button', { name: '收藏这张名片', exact: true })).toBeVisible()
  await page.goto('/#/pages/contacts/contacts')
  await searchWallet(page, '')
  await expect(page.locator('.count')).toHaveText('49')
  await openCard(page, overflow)
  await favoriteThroughPage(page, overflow.id, 403)
  await expect(page.getByText('普通用户名片夹最多收藏 10 张名片，VIP 可收藏 50 张', { exact: true })).toBeVisible()
})

test('expired membership hides advanced content and preserves it through a basic edit and renewal', async ({ page, request }) => {
  const user = await session(request, 'vip')
  await save(request, user, {
    appearance: { ...user.card.appearance, layout: 'centered' },
    sections: [
      { id: 'about', type: 'about', title: '关于我', content: '', visible: true },
      { id: 'contact', type: 'contact', title: '保持联系', content: '', visible: true },
      { id: 'premium', type: 'text', title: '高级内容', content: '续期后应恢复的内容', visible: true },
    ],
  })
  await signIn(page, user)
  await expect(page.getByText('续期后应恢复的内容', { exact: true })).toBeVisible()
  await membership(request, user, 'expired')
  await page.reload()
  await expect(page.locator('.identity-card')).toHaveClass(/minimal/)
  await expect(page.getByText('续期后应恢复的内容', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await expect(page.getByTestId('free-card-notice')).toBeVisible()
  await openContinuousEditor(page)
  await field(page, /^姓名\s*\*$/).fill('到期后更新的姓名')
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByText('到期后更新的姓名', { exact: true })).toBeVisible()
  await membership(request, user, 'vip')
  await page.reload()
  await expect(page.locator('.identity-card')).toHaveClass(/centered/)
  await expect(page.getByText('到期后更新的姓名', { exact: true })).toBeVisible()
  await expect(page.getByText('续期后应恢复的内容', { exact: true })).toBeVisible()
})

test('expiry during editing rejects the stale advanced save and keeps basic changes for an explicit retry', async ({ page, request }) => {
  const user = await session(request, 'vip')
  await save(request, user)
  await signIn(page, user)
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true })
  await field(page, /^姓名\s*\*$/).fill('仍然保留的草稿姓名')
  await page.getByRole('button', { name: '居中名片', exact: false }).click()
  await membership(request, user, 'expired')
  const refusedSave = page.waitForResponse(response => response.url().endsWith('/api/me/card') && response.request().method() === 'PUT')
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  expect((await refusedSave).status()).toBe(403)
  await expect(page.getByTestId('free-card-notice')).toBeVisible()
  await expect(field(page, /^姓名\s*\*$/)).toHaveValue('仍然保留的草稿姓名')
  await expect(page.locator('.module-editor')).toHaveCount(0)
  const unchanged = await request.get(`${api}/api/me/card`, { headers: headers(user) })
  expect((await unchanged.json()).data.name).toBe('会员测试名片')
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享名片', exact: true })).toBeVisible()
  await expect(page.getByText('仍然保留的草稿姓名', { exact: true })).toBeVisible()
  await expect(page.locator('.identity-card')).toHaveClass(/minimal/)
})
