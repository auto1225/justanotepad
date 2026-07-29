import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 손으로 넣은 쪽 나눔 — 워드·한글과 같이 무조건 지킨다.
 * 자리가 남아 있어도 그 뒤 내용은 다음 쪽에서 시작하고,
 * 한 줄에 나란히 놓이는 도형은 쪽 높이를 부풀리지 않는다.
 */

async function freshEditor(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

async function paste(page: Page, html: string) {
  await page.evaluate((source) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', source)
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, html)
}

const BREAK = '<hr data-page-break="1">'

test.describe('손으로 넣은 쪽 나눔', () => {
  test('자리가 남아도 나눔 뒤 내용은 다음 쪽에서 시작한다', async ({ page }) => {
    await freshEditor(page)
    await paste(page, `<p>첫 쪽</p>${BREAK}<p>둘째 쪽</p>${BREAK}<p>셋째 쪽</p>`)
    const pages = page.locator('[data-jan-page]')
    await expect(pages).toHaveCount(3, { timeout: 15000 })
    await expect(pages.nth(0)).toContainText('첫 쪽')
    await expect(pages.nth(1)).toContainText('둘째 쪽')
    await expect(pages.nth(2)).toContainText('셋째 쪽')
  })

  test('나눔만 홀로 넘어가 백지 한 장이 생기지 않는다', async ({ page }) => {
    await freshEditor(page)
    const filler = Array.from({ length: 26 }, (_, i) => `<p>${i + 1}번째 줄 — 쪽을 채우는 문단</p>`).join('')
    await paste(page, `${filler}${BREAK}<p>다음 쪽 첫 줄</p>`)
    const pages = page.locator('[data-jan-page]')
    await expect(pages.last()).toContainText('다음 쪽 첫 줄', { timeout: 15000 })
    const empties = await pages.evaluateAll((els) =>
      els.filter((el) => !(el as HTMLElement).innerText.trim()).length)
    expect(empties).toBe(0)
  })

  test('한 줄에 나란히 놓인 도형은 쪽 높이를 부풀리지 않는다', async ({ page }) => {
    await freshEditor(page)
    const row = '<p style="text-align:center">' +
      Array.from({ length: 4 }, (_, i) =>
        `<span class="jan-shape" data-jan-shape="shape" data-shape="round-rect" data-text="도형 ${i + 1}"` +
        ' data-w="110" data-h="56"></span>').join('') +
      '</p>'
    await paste(page, `<p>도형 줄 앞</p>${row}<p>도형 줄 뒤</p>`)
    const pages = page.locator('[data-jan-page]')
    await expect(pages.first()).toContainText('도형 줄 뒤', { timeout: 15000 })
    await expect(pages).toHaveCount(1)
  })
})
