import { test, expect } from '@playwright/test'

test('H5 exposes only WeChat registration and login and directs users to the mini program', async ({ page }) => {
  const authRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/'))
      authRequests.push(request.url())
  })
  await page.goto('/#/pages-work/account/account')
  await expect(page.getByText('体验模式', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: '微信直接注册', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '微信直接登录', exact: true })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /设置用户名和密码|修改密码|登录账号|注册账号/ })).toHaveCount(0)

  for (const name of ['微信直接注册', '微信直接登录']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByText('请在微信小程序中使用微信注册或登录', { exact: true }).last()).toBeVisible()
    await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeHidden()
  }
  await page.reload()
  await expect(page.getByRole('button', { name: '微信直接登录', exact: true })).toBeVisible()
  expect(authRequests).toEqual([])
  await page.screenshot({ path: 'artifacts/cloud-account-mobile.png', fullPage: true })
})

test('the cloud gateway rejects retired password registration, login, binding and password changes', async ({ request }) => {
  for (const [method, path] of [
    ['POST', '/auth/register'],
    ['POST', '/auth/login'],
    ['POST', '/me/account'],
    ['PUT', '/me/account/password'],
  ]) {
    const response = await request.fetch(`http://127.0.0.1:3200/api${path}`, {
      method,
      data: { username: 'retired_account', password: 'retired-password-123' },
    })
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ code: 403 })
  }
})
