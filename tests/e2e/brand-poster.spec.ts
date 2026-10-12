import { openContinuousEditor } from './helpers/editor'
import { test, expect, type Locator, type Page } from '@playwright/test'

async function upload(page: Page, button: Locator, name: string, base64: string) {
  const chooser = page.waitForEvent('filechooser')
  await button.click()
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
}

test('edit a brand poster, publish uploaded assets and show all pages continuously on mobile', async ({ page, browser }) => {
  test.setTimeout(90000)
  await page.goto('/')
  const fixtures = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 300; canvas.height = 480
    // Transparent illustration fixtures exercise uncropped, layered image placement.
    context.fillStyle = '#263b52'
    context.beginPath(); context.moveTo(35, 480); context.lineTo(60, 220); context.lineTo(150, 185); context.lineTo(240, 220); context.lineTo(280, 480); context.fill()
    context.fillStyle = '#fff'; context.beginPath(); context.moveTo(110, 205); context.lineTo(150, 350); context.lineTo(190, 205); context.fill()
    context.fillStyle = '#9e2e3c'; context.fillRect(142, 215, 16, 110)
    context.fillStyle = '#d4ac8f'; context.beginPath(); context.ellipse(150, 122, 62, 77, 0, 0, Math.PI * 2); context.fill()
    context.fillStyle = '#243037'; context.beginPath(); context.ellipse(150, 68, 65, 34, 0, Math.PI, Math.PI * 2); context.fill()
    const portrait = canvas.toDataURL('image/png').split(',')[1]
    canvas.width = 360; canvas.height = 100
    context.fillStyle = '#168e91'; context.font = 'bold 44px sans-serif'; context.fillText('UNFOLD', 8, 65)
    const logo = canvas.toDataURL('image/png').split(',')[1]
    const products = ['STRATEGY', 'DESIGN', 'DIGITAL'].map((title, index) => {
      canvas.width = 240; canvas.height = 260
      context.fillStyle = ['#d9eef1', '#e1e9ee', '#d4e8e7'][index]; context.fillRect(0, 0, 240, 260)
      context.fillStyle = '#ffffff'; context.fillRect(40, 70, 150, 150)
      context.fillStyle = '#168e91'; context.fillRect(65, 95, 105, 5); context.fillRect(65, 112, 70, 5)
      context.font = 'bold 19px sans-serif'; context.fillText(title, 65, 165)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    return { portrait, logo, products }
  })
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true, pages: true })
  await page.getByRole('button', { name: '应用品牌海报名片模板', exact: true }).click()
  await expect(page.locator('.poster-editor')).toBeVisible()
  const field = (label: string) => page.locator('.field').filter({ has: page.getByText(label, { exact: true }) })
  await field('封面文案').locator('textarea').fill('品牌设计\n数字增长赋能')
  await field('联系电话').locator('input').fill('010-00000000')
  await field('海报页脚口号').locator('input').fill('连接品牌、产品与增长')
  await upload(page, page.getByRole('button', { name: '上传品牌 Logo', exact: true }), 'logo.png', fixtures.logo)
  await expect(page.locator('.poster-brand-logo img')).toHaveJSProperty('naturalWidth', 360)
  await upload(page, page.getByRole('button', { name: '上传海报人物图', exact: true }), 'portrait.png', fixtures.portrait)
  await expect(page.locator('.poster-person-image img')).toHaveJSProperty('naturalWidth', 300)
  await page.getByRole('button', { name: '删除模块 1', exact: true }).click()
  await page.getByRole('button', { name: '删除模块 1', exact: true }).click()
  await page.getByRole('button', { name: '＋ 添加主营业务区', exact: true }).click()
  const business = page.locator('.module-row').first()
  for (const [index, title] of ['品牌策略', '视觉设计', '数字体验'].entries()) {
    const block = business.locator('.content-editor-block').nth(index)
    await block.locator('input').first().fill(title)
    await block.locator('textarea').fill(['定位梳理\n品牌增长咨询', '品牌识别\n视觉系统设计', '网站与小程序\n数字产品体验'][index])
    await upload(page, block.getByRole('button', { name: '上传图片', exact: true }), `product-${index}.png`, fixtures.products[index])
    await expect(block.locator('.image-thumbnail')).toHaveCount(1)
  }
  await page.getByRole('button', { name: '＋ 添加服务介绍区', exact: true }).click()
  const services = page.locator('.module-row').nth(1)
  for (const [index, title] of ['专业咨询', '项目增长', '团队赋能'].entries()) {
    const block = services.locator('.content-editor-block').nth(index)
    await block.locator('input').first().fill(title)
    await block.locator('textarea').fill(['明确业务与品牌方向', '让设计支持业务发展', '提升团队协作效率'][index])
  }
  await page.getByRole('button', { name: '＋ 添加页面', exact: true }).click()
  await page.locator('.page-row').nth(1).locator('input').fill('合作')
  await page.locator('.module-group').nth(1).getByRole('button', { name: '＋ 添加文字段落', exact: true }).click()
  await page.locator('.module-row').nth(2).locator('textarea').fill('第二页也连续展示，不需要点击导航。')
  await page.getByRole('button', { name: '预览名片', exact: true }).click()
  await expect(page.locator('.live-preview .section-grid')).toHaveCount(2)
  await expect(page.locator('.live-preview .content-showcase')).toHaveCount(2)
  await expect(page.locator('.live-preview .page-tabs')).toHaveCount(0)
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByRole('button', { name: '访客视角', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '访客视角', exact: true }).click()
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const visitor = await guest.newPage()
    await visitor.goto(page.url())
    await expect(visitor.locator('.identity-card')).toHaveClass(/template-poster/)
    await expect(visitor.locator('.poster-headline')).toHaveText('品牌设计\n数字增长赋能', { useInnerText: true })
    await expect(visitor.locator('.poster-brand-logo img')).toHaveJSProperty('naturalWidth', 360)
    await expect(visitor.locator('.poster-person-image img')).toHaveJSProperty('naturalWidth', 300)
    await expect(visitor.locator('.content-showcase .gallery-image img')).toHaveCount(3)
    await expect(visitor.locator('.section-content')).toHaveText('第二页也连续展示，不需要点击导航。')
    await expect(visitor.locator('.footer-slogan')).toHaveText('连接品牌、产品与增长')
    await expect(visitor.locator('.message-board')).toBeVisible()
    const tiles = visitor.locator('.content-showcase').first().locator('.card-content-block')
    for (const width of [390, 320]) {
      await visitor.setViewportSize({ width, height: 844 })
      const boxes = await Promise.all([0, 1, 2].map(index => tiles.nth(index).boundingBox()))
      expect(boxes[0]!.y).toBe(boxes[1]!.y)
      expect(boxes[1]!.y).toBe(boxes[2]!.y)
      expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width)
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await visitor.setViewportSize({ width: 390, height: 844 })
    await visitor.screenshot({ path: 'artifacts/brand-poster-mobile.png', fullPage: true })
  }
  finally { await guest.close() }
  await page.getByRole('button', { name: '编辑我的名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true, pages: true })
  await expect(page.getByRole('button', { name: '应用品牌海报名片模板', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(field('海报页脚口号').locator('input')).toHaveValue('连接品牌、产品与增长')
  await expect(page.locator('.module-row').first().getByRole('button', { name: '三列展示', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
