import { test, expect, type Page } from '@playwright/test'

async function expectWechatOnly(page: Page) {
  await expect(page.getByRole('button', { name: '微信直接登录', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '微信直接注册', exact: true })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /设置用户名和密码|修改密码|登录账号|注册账号/ })).toHaveCount(0)
}

test('offers only WeChat registration and login, without falling back to a demo account on H5', async ({ page }) => {
  const authRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/'))
      authRequests.push(request.url())
  })
  await page.goto('/#/pages-work/account/account')
  await expectWechatOnly(page)
  await expect(page.getByText('请在微信小程序中使用微信注册或登录', { exact: true }).first()).toBeVisible()

  for (const name of ['微信直接注册', '微信直接登录']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByText('请在微信小程序中使用微信注册或登录', { exact: true }).last()).toBeVisible()
    await expectWechatOnly(page)
  }
  await page.reload()
  await expectWechatOnly(page)
  expect(authRequests).toEqual([])
  await page.screenshot({ path: 'artifacts/account-mobile.png', fullPage: true })
})

test('signs out of an isolated test session and stays signed out after reload and navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '编辑名片', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '我的账号', exact: true }).click()
  await expect(page.getByText('开发测试账号', { exact: true })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /设置用户名和密码|修改密码/ })).toHaveCount(0)

  const logoutResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'))
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  expect((await logoutResponse).status()).toBe(200)
  await expectWechatOnly(page)

  const loginRequests: string[] = []
  page.on('request', request => {
    if (/\/api\/auth\/(dev|wechat|login|register)$/.test(new URL(request.url()).pathname))
      loginRequests.push(request.url())
  })
  await page.reload()
  await expectWechatOnly(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '微信登录 / 注册', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑名片', exact: true })).toBeHidden()
  expect(loginRequests).toEqual([])
})
