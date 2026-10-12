import { openContinuousEditor } from './helpers/editor'
import { test, expect, type Page, type Locator } from '@playwright/test'

async function choose(page: Page, button: Locator, files: { name: string, mimeType: string, buffer: Buffer }[]) {
  const chooser = page.waitForEvent('filechooser')
  await button.click()
  await (await chooser).setFiles(files)
}

test('upload gallery, video and poster; save, reload and play as a public visitor', async ({ page, browser }) => {
  test.setTimeout(90000)
  await page.goto('/')
  const fixtures = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 480; canvas.height = 320
    const context = canvas.getContext('2d')!
    context.fillStyle = '#234e3e'; context.fillRect(0, 0, 480, 320)
    context.fillStyle = '#e2eebc'; context.font = '36px sans-serif'; context.fillText('PORTFOLIO / 01', 60, 165)
    const image = canvas.toDataURL('image/png').split(',')[1]
    const stream = canvas.captureStream(15)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    const chunks: Blob[] = []
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
    recorder.start()
    const timer = setInterval(() => {
      context.fillStyle = '#234e3e'; context.fillRect(0, 0, 480, 320)
      context.fillStyle = '#e2eebc'; context.fillRect(40 + Math.random() * 320, 100, 60, 60)
    }, 50)
    await new Promise(resolve => setTimeout(resolve, 700))
    clearInterval(timer); recorder.stop(); await stopped
    stream.getTracks().forEach(track => track.stop())
    return { image, video: Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())) }
  })
  const photo = { name: 'portfolio.png', mimeType: 'image/png', buffer: Buffer.from(fixtures.image, 'base64') }
  await page.getByRole('button', { name: '编辑名片', exact: true }).click()
  await openContinuousEditor(page)
  await page.getByRole('button', { name: '＋ 添加图片模块', exact: true }).click()
  const rows = page.locator('.module-row')
  const gallery = rows.nth(2)
  await gallery.locator('input').first().fill('我的作品')
  await choose(page, gallery.getByRole('button', { name: '上传图片', exact: true }), [photo, { ...photo, name: 'portfolio-two.png' }])
  await expect(gallery.locator('.image-thumbnail')).toHaveCount(2)
  await expect(gallery.getByRole('button', { name: '上传图片', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '＋ 添加视频模块', exact: true }).click()
  const video = rows.nth(3)
  await video.locator('input').first().fill('动态介绍')
  await choose(page, video.getByRole('button', { name: '上传视频', exact: true }), [{ name: 'intro.webm', mimeType: 'video/webm', buffer: Buffer.from(fixtures.video) }])
  await expect(video.getByRole('button', { name: '更换视频', exact: true })).toBeEnabled()
  await choose(page, video.getByRole('button', { name: '上传视频封面', exact: true }), [photo])
  await expect(video.getByRole('button', { name: '更换视频封面', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '＋ 添加链接模块', exact: true }).click()
  const link = rows.nth(4)
  await link.locator('input').nth(0).fill('更多作品')
  await link.locator('input').nth(1).fill('https://example.com/portfolio')
  await link.locator('input').nth(2).fill('查看作品集')
  await page.getByRole('button', { name: '预览名片', exact: true }).click()
  await expect(page.locator('.live-preview .gallery-grid .gallery-image')).toHaveCount(2)
  await expect(page.locator('.live-preview .section-video')).toHaveCount(1)
  await page.getByRole('button', { name: '保存我的名片', exact: true }).click()
  await expect(page.getByRole('button', { name: '分享名片', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.gallery-image')).toHaveCount(2)
  await expect(page.locator('.section-video')).toHaveCount(1)
  await page.getByRole('button', { name: '访客视角', exact: true }).click()
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const visitor = await guest.newPage()
    await visitor.goto(page.url())
    await expect(visitor.locator('.gallery-image')).toHaveCount(2)
    const imageUrl = await visitor.locator('.gallery-image img').first().getAttribute('src')
    expect((await visitor.request.get(imageUrl!)).status()).toBe(200)
    const player = visitor.locator('video')
    await expect(player).toHaveCount(1)
    await expect(player).toHaveAttribute('poster', /\/api\/media\//)
    await player.evaluate(async (element: HTMLVideoElement) => { element.muted = true; await element.play() })
    await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0)
    await player.evaluate((element: HTMLVideoElement) => element.pause())
    await expect(visitor.getByRole('button', { name: '查看作品集', exact: false })).toBeVisible()
    await visitor.screenshot({ path: 'artifacts/media-profile-mobile.png', fullPage: true })
  }
  finally { await guest.close() }
  await page.getByRole('button', { name: '编辑我的名片', exact: true }).click()
  await openContinuousEditor(page)
  await gallery.getByRole('button', { name: '删除图片 2', exact: true }).click()
  await gallery.getByRole('button', { name: '纵向展示', exact: true }).click()
  await expect(gallery.locator('.image-thumbnail')).toHaveCount(1)
  await video.getByRole('button', { name: '移除封面', exact: true }).click()
  await expect(video.getByRole('button', { name: '上传视频封面', exact: true })).toBeVisible()
})
