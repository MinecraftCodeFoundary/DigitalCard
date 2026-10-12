import { openContinuousEditor } from './helpers/editor'
import { writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

const themes = [
  { id: 'obsidian', name: '黑金尊享', usage: '商务洽谈 · 品牌主理人' },
  { id: 'porcelain', name: '青瓷留白', usage: '独立顾问 · 文化工作者' },
  { id: 'editorial', name: '杂志艺文', usage: '设计师 · 写作者' },
  { id: 'sunset', name: '落日暖橙', usage: '摄影师 · 生活方式品牌' },
  { id: 'aurora', name: '极光科技', usage: '科技团队 · 产品与研发' },
  { id: 'botanical', name: '自然森语', usage: '花艺 · 手作与自然品牌' },
]

test('theme categories help beginners choose a style without changing their card content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 })
  await page.goto('/')
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await page.getByRole('button', { name: '第 3 步：风格与发布', exact: true }).click()
  await expect(page.locator('.template-option')).toHaveCount(12)
  await page.getByRole('button', { name: '查看商务主题', exact: true }).click()
  await expect(page.locator('.template-option')).toHaveCount(3)
  await page.getByRole('button', { name: '应用黑金尊享模板', exact: true }).click()
  await expect(page.getByText('当前：黑金尊享', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看简约主题', exact: true }).click()
  await expect(page.locator('.template-option')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '应用青瓷留白模板', exact: true })).toBeVisible()
  await expect(page.getByText('当前：黑金尊享', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看创意主题', exact: true }).click()
  await expect(page.locator('.template-option')).toHaveCount(4)
  await page.getByRole('button', { name: '恢复默认风格', exact: true }).click()
  await expect(page.getByRole('button', { name: '查看全部主题', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '应用清新简约模板', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '第 1 步：身份与联系', exact: true }).click()
  await expect(page.locator('#edit-profile .field input').first()).toHaveValue('林予安')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('new dark themes keep cover text readable after choosing a light custom color', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true })
  const color = page.locator('.field').filter({ has: page.getByText('自定义主题色', { exact: true }) }).locator('input')
  for (const name of ['黑金尊享', '落日暖橙', '极光科技', '自然森语']) {
    await page.getByRole('button', { name: `应用${name}模板`, exact: true }).click()
    await color.fill('#f4d35e')
    await page.getByRole('button', { name: '预览名片', exact: true }).click()
    for (const selector of ['.cover-title', '.cover-label', '.cover-signature'])
      await expect(page.locator(`.live-preview ${selector}`)).toHaveCSS('color', 'rgb(23, 37, 29)')
    await page.getByRole('button', { name: '关闭预览', exact: true }).click()
  }
})

test('all six new themes survive saving and render readable mobile visitor cards', async ({ page, browser }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page, { appearance: true })
  const cover = page.locator('.field').filter({ has: page.getByText('封面文案', { exact: true }) }).locator('textarea')
  await cover.fill('让专业被看见\n让合作发生。')
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const visitor = await guest.newPage()
  const gallery: string[] = []
  try {
    for (const theme of themes) {
      await page.getByRole('button', { name: `应用${theme.name}模板`, exact: true }).click()
      await expect(cover).toHaveValue('让专业被看见\n让合作发生。')
      await page.getByRole('button', { name: '预览名片', exact: true }).click()
      await expect(page.locator('.live-preview .template-decoration')).toHaveClass(new RegExp(`decoration-${theme.id}`))
      await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
      await expect(page.getByRole('button', { name: '分享名片', exact: true })).toBeVisible()
      await page.reload()
      await expect(page.locator('.identity-card')).toHaveClass(new RegExp(`template-${theme.id}`))
      await page.getByRole('button', { name: '访客视角', exact: true }).click()
      if (visitor.url() === page.url())
        await visitor.reload()
      else
        await visitor.goto(page.url())
      const identity = visitor.locator('.identity-card')
      await expect(identity).toHaveClass(new RegExp(`template-${theme.id}`))
      await expect(visitor.locator('.cover-title')).toHaveText('让专业被看见\n让合作发生。', { useInnerText: true })
      await expect(visitor.locator('.card-sections')).toHaveClass(new RegExp(`template-${theme.id}`))
      await expect(visitor.locator('.message-board')).toHaveClass(new RegExp(`template-${theme.id}`))
      const contrasts = await identity.evaluate(element => {
        function luminance(color: string) {
          const values = color.match(/[\d.]+/g)!.slice(0, 3).map(value => Number(value) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
        }
        return ['.card-name', '.card-company'].map(selector => {
          const text = luminance(getComputedStyle(element.querySelector(selector)!).color)
          const background = luminance(getComputedStyle(element).backgroundColor)
          return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
        })
      })
      for (const contrast of contrasts)
        expect(contrast, `${theme.name} 的姓名和公司应保持清晰可读`).toBeGreaterThanOrEqual(4.5)
      for (const width of [320, 390]) {
        await visitor.setViewportSize({ width, height: 844 })
        expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      const picture = await identity.screenshot({ path: `artifacts/theme-${theme.id}-card.png` })
      gallery.push(`<figure><figcaption><strong>${theme.name}</strong><span>${theme.usage}</span></figcaption><img alt="${theme.name}名片实机预览" src="data:image/png;base64,${picture.toString('base64')}"></figure>`)
      await visitor.screenshot({ path: `artifacts/theme-${theme.id}-visitor.png`, fullPage: true })
      await page.getByRole('button', { name: '编辑我的名片', exact: true }).click()
      await page.getByRole('button', { name: '第 3 步：风格与发布', exact: true }).click()
      await expect(page.getByRole('button', { name: `应用${theme.name}模板`, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await openContinuousEditor(page, { appearance: true })
    }
    const html = `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>一面 · 六款新主题</title><style>*{box-sizing:border-box}body{margin:0;background:#eeeee8;color:#29382e;font-family:"Microsoft YaHei",sans-serif;padding:36px}header{margin:0 0 28px}h1{font-size:30px;margin:0 0 8px}p{color:#697365;margin:0;font-size:14px}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}figure{margin:0;min-width:0}figcaption{margin:0 0 12px}strong{display:block;font-size:18px;margin-bottom:5px}span{font-size:12px;color:#667061}img{display:block;width:100%;height:auto;border-radius:12px}@media(max-width:700px){body{padding:20px}.gallery{grid-template-columns:1fr}}</style><header><h1>一面 · 六款新主题</h1><p>保存后的真实名片展示 · 资料和内容保持不变，一键切换风格</p></header><main class="gallery">${gallery.join('')}</main></html>`
    await writeFile('artifacts/new-card-themes.html', html, 'utf8')
    const overview = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
    try {
      await overview.setContent(html)
      await overview.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())))
      await overview.screenshot({ path: 'artifacts/new-card-themes.png', fullPage: true })
    }
    finally { await overview.close() }
  }
  finally { await guest.close() }
})
