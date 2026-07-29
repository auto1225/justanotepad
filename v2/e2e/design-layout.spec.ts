import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 워드 「디자인」·「레이아웃」 탭 —
 * 문서 서식 한 벌 · 테마 · 페이지 배경 · 텍스트 방향 · 줄 번호 · 하이픈 · 원고지.
 * 고르면 문서가 실제로 그 모습이 되는지까지 본다.
 */

async function ready(page: Page) {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', '<h1>제목입니다</h1><p>본문 한 줄입니다.</p>')
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(editor.locator('h1')).toHaveCount(1)
  await page.waitForTimeout(500) // 붙인 글이 저장소에 담길 틈 (앱은 350ms 뒤에 담는다)
  return editor
}

async function tab(page: Page, name: string) {
  await page.locator('.jan-ribbon-tab', { hasText: new RegExp(`^${name}$`) }).first().click()
}

/** 리본의 ▾ 단추를 열고 그 안의 항목을 고른다 */
async function pickFromMenu(page: Page, button: string, item: string) {
  await page.locator('body').click({ position: { x: 5, y: 400 } })
  await page.locator(`button[aria-label^="${button}"]`).first().click()
  await page.locator('.jan-ribbon-dropdown button', { hasText: item }).first().click()
}

test.describe('디자인 탭', () => {
  test('묶음이 워드와 같다 — 문서 서식 · 테마 · 페이지 배경', async ({ page }) => {
    await ready(page)
    await tab(page, '디자인')
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps.slice(0, 3)).toEqual(['문서 서식', '테마', '페이지 배경'])
  })

  test('문서 서식을 고르면 제목·본문이 그 벌로 갈아입는다', async ({ page }) => {
    const editor = await ready(page)
    await tab(page, '디자인')

    await page.locator('button[aria-label^="문서 서식: 기본"]').first().click()
    const basic = await editor.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0])

    await page.locator('button[aria-label^="문서 서식: 논문"]').first().click()
    const thesis = await editor.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily.split(',')[0])
    const indent = await editor.locator('p').first().evaluate((el) => getComputedStyle(el).textIndent)

    expect(basic).not.toBe(thesis)          // 고딕 → 명조
    expect(parseFloat(indent)).toBeGreaterThan(0) // 논문 벌은 첫 줄을 들여쓴다
  })

  test('테마 색을 바꾸면 제목 색이 따라간다', async ({ page }) => {
    const editor = await ready(page)
    await tab(page, '디자인')
    await page.locator('button[aria-label^="문서 서식: 보고서"]').first().click() // 제목에 테마 색을 쓰는 벌
    const before = await editor.locator('h1').first().evaluate((el) => getComputedStyle(el).color)
    await pickFromMenu(page, '테마 색', '와인')
    await expect.poll(() => editor.locator('h1').first().evaluate((el) => getComputedStyle(el).color)).not.toBe(before)
  })

  test('페이지 배경 — 쪽 색·쪽 테두리·워터마크가 실제로 붙는다', async ({ page }) => {
    await ready(page)
    await tab(page, '디자인')
    await page.locator('button[aria-label^="문서 서식 갤러리"]').first().click()
    const dialog = page.locator('.jan-designdlg')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('tab', { name: '페이지 배경' }).click()

    await dialog.locator('button[aria-label="페이지 색 세피아"]').click()
    await dialog.locator('select[aria-label="쪽 테두리 모양"]').selectOption('double')
    await dialog.locator('input[aria-label="워터마크 글"]').fill('대외비')

    const page1 = page.locator('.jan-page-node').first()
    await expect.poll(() => page1.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(246, 239, 226)')
    await expect.poll(() => page1.evaluate((el) => getComputedStyle(el, '::before').borderTopStyle)).toBe('double')
    await expect(page.locator('.jan-page-watermark')).toHaveCount(1)
  })
})

test.describe('레이아웃 탭', () => {
  test('묶음이 워드와 같다 — 페이지 설정 · 원고지 · 단락 · 정렬', async ({ page }) => {
    await ready(page)
    await tab(page, '레이아웃')
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps.slice(0, 4)).toEqual(['페이지 설정', '원고지', '단락', '정렬'])
  })

  test('줄 번호를 켜면 문단마다 번호가 붙는다', async ({ page }) => {
    const editor = await ready(page)
    await tab(page, '레이아웃')
    await pickFromMenu(page, '줄 번호', '연속')
    await expect.poll(() => editor.locator('p').first().evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('counter')
  })

  test('세로쓰기로 바꾸면 글이 오른쪽에서 왼쪽으로 흐른다', async ({ page }) => {
    const editor = await ready(page)
    await tab(page, '레이아웃')
    await pickFromMenu(page, '텍스트 방향', '세로쓰기')
    await expect.poll(() => editor.evaluate((el) => getComputedStyle(el).writingMode)).toBe('vertical-rl')
    await pickFromMenu(page, '텍스트 방향', '가로쓰기')
    await expect.poll(() => editor.evaluate((el) => getComputedStyle(el).writingMode)).toBe('horizontal-tb')
  })

  test('원고지를 켜면 칸이 깔리고, 끄면 사라진다', async ({ page }) => {
    await ready(page)
    await tab(page, '레이아웃')
    await pickFromMenu(page, '원고지 설정', '200자')
    const page1 = page.locator('.jan-page-node').first()
    await expect.poll(() => page1.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('repeating-linear-gradient')
    await pickFromMenu(page, '원고지 설정', '원고지 끄기')
    await expect.poll(() => page1.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none')
  })

  test('하이픈을 자동으로 두면 긴 영문 낱말이 줄 끝에서 나뉜다', async ({ page }) => {
    const editor = await ready(page)
    await tab(page, '레이아웃')
    await pickFromMenu(page, '하이픈 넣기', '자동')
    await expect.poll(() => editor.locator('p').first().evaluate((el) => getComputedStyle(el).hyphens)).toBe('auto')
  })
})
