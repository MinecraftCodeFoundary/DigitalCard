import { test, expect, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const width of [320, 375]) {
  test(`mobile editor keeps all three scenarios and actions usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 667 })
    await page.goto('/')
    const share = page.getByRole('button', { name: '分享名片', exact: true })
    await expect(share).toBeVisible()
    const shareBox = await share.boundingBox()
    const navBox = await page.locator('.bottom-nav').boundingBox()
    expect(shareBox!.y + shareBox!.height).toBeLessThanOrEqual(navBox!.y)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `artifacts/mobile-${width}-home.png` })

    await page.getByRole('button', { name: '编辑名片', exact: true }).click()
    await expect(page.getByRole('button', { name: '下一步：业务与展示', exact: true })).toBeInViewport()
    await expect(page.locator('#edit-contact')).toBeVisible()
    await expect(page.locator('#edit-content')).toBeHidden()
    await expect(page.locator('#edit-appearance-more')).toBeHidden()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: `artifacts/mobile-${width}-edit.png` })
    await page.getByRole('button', { name: '下一步：业务与展示', exact: true }).click()
    for (const scenario of ['商务名片', '业务展示', '个人主页']) {
      await page.getByRole('button', { name: scenario, exact: true }).click()
      await expect(page.getByRole('button', { name: scenario, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expectNoHorizontalOverflow(page)
    }
    await expect(page.locator('.page-row')).toBeHidden()
    await page.getByRole('button', { name: '页面与排版设置', exact: true }).click()
    await page.getByRole('button', { name: '模块 1 更多设置', exact: true }).click()
    await expect(page.getByRole('button', { name: '下一步：风格与发布', exact: true })).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: '下一步：风格与发布', exact: true }).click()
    const save = page.getByRole('button', { name: '保存我的名片', exact: true })
    await expect(save).toBeInViewport()
    await expect(page.locator('.live-preview')).toBeHidden()
    await page.getByRole('button', { name: /调整样式细节/ }).click()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: '预览名片', exact: true }).click()
    await expect(page.locator('.live-preview')).toBeVisible()
    await expect(save).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: '关闭预览', exact: true }).click()
    await expect(page.locator('.live-preview')).toBeHidden()
    await page.getByRole('button', { name: '连续填写', exact: true }).click()
    await expect(save).toBeInViewport()
    await expectNoHorizontalOverflow(page)

    // The desktop browser is a mobile preview too, so the bottom navigation stays put.
    await page.getByRole('button', { name: '返回', exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator('.bottom-nav')).toHaveCSS('position', 'fixed')
    expect((await page.locator('.app-shell').boundingBox())!.width).toBeLessThanOrEqual(480)
  })
}
