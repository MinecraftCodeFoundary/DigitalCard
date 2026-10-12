import { expect, type Locator, type Page } from '@playwright/test'

export async function openContinuousEditor(page: Page, options: { appearance?: boolean, pages?: boolean } = {}) {
  await page.getByRole('button', { name: '连续填写', exact: true }).click()
  if (options.pages)
    await page.getByRole('button', { name: '页面与排版设置', exact: true }).click()
  if (options.appearance)
    await page.getByRole('button', { name: /调整样式细节/ }).click()
}

export async function openModuleSettings(row: Locator) {
  const button = row.getByRole('button', { name: /更多设置/ })
  if (await button.getAttribute('aria-expanded') !== 'true')
    await button.click()
}

async function waitForEditorScroll(page: Page) {
  const stable = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const started = performance.now()
    let stableSince = started
    let previous = ''
    function sample() {
      const now = performance.now()
      const position = JSON.stringify([
        scrollY,
        ...Array.from(document.querySelectorAll('.module-row .drag-handle')).map((handle) => {
          const rect = handle.getBoundingClientRect()
          return [rect.x, rect.y, rect.width, rect.height]
        }),
      ])
      if (position !== previous) {
        previous = position
        stableSince = now
      }
      // Observe a quiet period, restarting it whenever animated scrolling or layout changes.
      if (now - stableSince >= 350)
        resolve(true)
      else if (now - started >= 5000)
        resolve(false)
      else
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
  expect(stable, 'editor scrolling and drag handle positions should settle').toBe(true)
}

export async function dragModule(page: Page, source: Locator, target: Locator) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
  })
  // Adding a module animates scrolling; let that finish before positioning either handle.
  await waitForEditorScroll(page)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox)
    throw new Error('both module drag handles must have a bounding box')
  const viewport = await page.evaluate(() => {
    const footer = document.querySelector('.mobile-action-bar')?.getBoundingClientRect()
    return { top: 64, bottom: Math.min(innerHeight, footer?.top ?? innerHeight) - 64 }
  })
  const top = Math.min(sourceBox.y, targetBox.y)
  const bottom = Math.max(sourceBox.y + sourceBox.height, targetBox.y + targetBox.height)
  const span = bottom - top
  expect(span, 'both handles must fit clear of viewport edges and the fixed footer').toBeLessThanOrEqual(viewport.bottom - viewport.top)
  const inset = viewport.top + (viewport.bottom - viewport.top - span) / 2
  await page.evaluate(offset => window.scrollBy({ top: offset, behavior: 'instant' }), top - inset)
  await waitForEditorScroll(page)
  await expect(source).toBeInViewport({ ratio: 1 })
  await expect(target).toBeInViewport({ ratio: 1 })
  // Keep native mouse dragging: no synthetic drag/drop events or direct model changes.
  await source.dragTo(target)
}
