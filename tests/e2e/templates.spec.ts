import { openContinuousEditor } from './helpers/editor'
import { test, expect } from '@playwright/test'

test('switch complete templates, preserve content and show the saved style to mobile visitors', async ({ page, browser }) => {
  test.setTimeout(90000)
  await page.goto('/')
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true, pages: true })
  const cover = page.locator('.field').filter({ has: page.getByText('封面文案', { exact: true }) }).locator('textarea')
  await cover.fill('认识有缘的你\n共创美好未来')
  await page.getByRole('button', { name: '＋ 添加页面', exact: true }).click()
  await page.locator('.page-row').nth(1).locator('input').fill('合作')
  await page.locator('.module-group').nth(0).getByRole('button', { name: '＋ 添加文字段落', exact: true }).click()
  await page.locator('.module-row').nth(2).locator('input').fill('合作寄语')
  await page.locator('.module-row').nth(2).locator('textarea').fill('切换模板，仍保留我自己写的内容。')
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const visitor = await guest.newPage()
  try {
    for (const [id, name] of [['festive', '喜庆红金'], ['business', '蓝金商务'], ['neon', '炫彩霓虹'], ['floral', '花纹雅致']]) {
      await page.getByRole('button', { name: `应用${name}模板`, exact: true }).click()
      await expect(cover).toHaveValue('认识有缘的你\n共创美好未来')
      await expect(page.locator('.module-row').nth(2).locator('textarea')).toHaveValue('切换模板，仍保留我自己写的内容。')
      await page.getByRole('button', { name: '预览名片', exact: true }).click()
      await expect(page.locator('.live-preview .identity-card')).toHaveClass(new RegExp(`template-${id}`))
      await expect(page.locator('.live-preview .template-decoration')).toHaveClass(new RegExp(`decoration-${id}`))
      await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
      await expect(page.getByRole('button', { name: '分享名片', exact: true })).toBeVisible()
      await page.getByRole('button', { name: '访客视角', exact: true }).click()
      if (visitor.url() === page.url())
        await visitor.reload()
      else
        await visitor.goto(page.url())
      await expect(visitor.locator('.identity-card')).toHaveClass(new RegExp(`template-${id}`))
      await expect(visitor.locator('.cover-title')).toHaveText('认识有缘的你\n共创美好未来', { useInnerText: true })
      await expect(visitor.locator('.section-content').last()).toHaveText('切换模板，仍保留我自己写的内容。')
      await expect(visitor.locator('.card-sections')).toHaveClass(new RegExp(`template-${id}`))
      await expect(visitor.locator('.message-board')).toHaveClass(new RegExp(`template-${id}`))
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (id === 'neon') {
        await expect(visitor.locator('.card-name')).toHaveCSS('color', 'rgb(245, 234, 250)')
        await expect(visitor.locator('.profile-section').first()).toHaveCSS('background-color', 'rgb(28, 23, 48)')
      }
      await visitor.screenshot({ path: `artifacts/template-${id}-mobile.png`, fullPage: true })
      await page.getByRole('button', { name: '编辑我的名片', exact: true }).click()
      await openContinuousEditor(page, { appearance: true, pages: true })
      await expect(page.getByRole('button', { name: `应用${name}模板`, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
    await page.getByRole('button', { name: '应用清新简约模板', exact: true }).click()
    await expect(page.locator('.module-row').nth(2).locator('textarea')).toHaveValue('切换模板，仍保留我自己写的内容。')
    await expect(page.getByText('名片已更新', { exact: true })).not.toBeVisible()
    await page.locator('.template-picker').screenshot({ path: 'artifacts/card-template-picker.png' })
  }
  finally { await guest.close() }
})
