import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 개체를 고르면 바로 뜨는 상황 막대와, 표 테두리·채우기·맞춤·여백.
 * 워드의 미니 도구 모음 + 「표 디자인 › 테두리·음영」 자리다.
 */

async function tableEditor(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
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
    dt.setData('text/html', '<table><tbody>' +
      '<tr><td><p>A</p></td><td><p>B</p></td><td><p>C</p></td></tr>' +
      '<tr><td><p>D</p></td><td><p>E</p></td><td><p>F</p></td></tr>' +
      '<tr><td><p>G</p></td><td><p>H</p></td><td><p>I</p></td></tr></tbody></table><p>뒤 문단</p>')
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.ProseMirror table td')).toHaveCount(9)
  await page.waitForTimeout(900)
  return editor
}

/** 왼쪽 위 2×2 칸을 고른다 */
async function pickFourCells(page: Page) {
  await page.locator('.ProseMirror table td').nth(0).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('Alt+s')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await expect(page.locator('.ProseMirror .selectedCell')).toHaveCount(4)
}

test.describe('표 서식과 상황 막대', () => {
  test('칸을 고르면 상황 막대가 표 위쪽에 뜬다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)

    const bar = page.locator('.jan-object-bar')
    await expect(bar).toBeVisible()
    await expect(bar.locator('.jan-object-bar-tag')).toHaveText('2행 2열')

    // 막대는 표를 덮지 않는다 — 덮으면 다음 칸을 누를 수 없다
    const [barBottom, tableTop] = await page.evaluate(() => {
      const b = document.querySelector('.jan-object-bar') as HTMLElement
      const t = document.querySelector('.ProseMirror table') as HTMLElement
      return [b.getBoundingClientRect().bottom, t.getBoundingClientRect().top]
    })
    expect(barBottom).toBeLessThanOrEqual(tableTop + 1)
  })

  test('막대에서 테두리와 채우기를 바로 준다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)

    await page.locator('.jan-object-bar button', { hasText: '모든 선' }).click()
    const first = page.locator('.ProseMirror table td').first()
    await expect(first).toHaveAttribute('data-bt', /solid/)
    const border = await first.evaluate((el) => getComputedStyle(el).borderTopWidth)
    expect(parseFloat(border)).toBeGreaterThan(0)

    await page.locator('.jan-object-bar-swatch').first().click()
    const bg = await first.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toBe('rgb(254, 240, 199)')

    // 고른 칸은 그대로 남아 이어서 다른 서식을 줄 수 있다
    await expect(page.locator('.ProseMirror .selectedCell')).toHaveCount(4)
  })

  test('테두리 없음은 그은 선을 지운다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.locator('.jan-object-bar button', { hasText: '모든 선' }).click()
    await expect(page.locator('.ProseMirror table td').first()).toHaveAttribute('data-bt', /solid/)

    await page.locator('.jan-object-bar button', { hasText: '선 없음' }).click()
    await expect(page.locator('.ProseMirror table td').first()).toHaveAttribute('data-bt', 'none')
  })

  test('표 서식 창에서 아홉 칸 맞춤·여백·들여쓰기를 준다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.locator('.jan-object-bar button', { hasText: '맞춤...' }).click()

    const dlg = page.locator('.jan-tblfmt')
    await expect(dlg).toBeVisible()
    await expect(page.locator('.jan-tblfmt-tabs button')).toHaveText(['테두리', '채우기', '맞춤과 여백'])

    // 아홉 칸 중 마지막 = 아래 오른쪽
    await page.locator('.jan-tblfmt-align button').nth(8).click()
    const cell = page.locator('.ProseMirror table td').first()
    await expect(cell).toHaveAttribute('data-valign', 'bottom')
    expect(await cell.locator('p').evaluate((el) => getComputedStyle(el).textAlign)).toBe('right')

    // 칸 여백
    await page.locator('.jan-tblfmt button', { hasText: '10px 12px' }).click()
    await expect(cell).toHaveAttribute('data-pad', '10px 12px')

    // 들여쓰기
    await page.locator('.jan-tblfmt button', { hasText: '들여쓰기' }).click()
    await expect(cell.locator('p')).toHaveAttribute('data-indent', '1')
  })

  test('펜을 바꾸면 그 굵기·모양으로 그어진다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.locator('.jan-object-bar button', { hasText: '선 모양...' }).click()
    await expect(page.locator('.jan-tblfmt')).toBeVisible()

    await page.locator('.jan-tblfmt select').first().selectOption('3')
    await page.locator('.jan-tblfmt select').nth(1).selectOption('dashed')
    await page.locator('.jan-tblfmt-grid button', { hasText: '바깥쪽 테두리' }).click()

    const first = page.locator('.ProseMirror table td').first()
    await expect(first).toHaveAttribute('data-bt', '3|dashed|#333333')
    // 안쪽 변에는 긋지 않는다 — 바깥쪽만 고른 경우
    await expect(first).not.toHaveAttribute('data-br', /./)
  })

  test('그림과 도형에도 상황 막대가 뜬다', async ({ page }) => {
    await tableEditor(page)
    await page.keyboard.press('Control+End')
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } })))
    await expect(page.locator('.jan-shapedlg-grid button').first()).toBeFocused()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Alt+s')

    const bar = page.locator('.jan-object-bar')
    await expect(bar).toBeVisible()
    await expect(bar.locator('.jan-object-bar-tag')).toHaveText('도형')
    await expect(bar.getByRole('button', { name: /서식/ })).toHaveCount(1)
  })

  test('서식 줄에 양쪽 맞춤 단추가 있다', async ({ page }) => {
    await tableEditor(page)
    await page.keyboard.press('Control+End')
    await page.keyboard.type('양쪽으로 고르게 펴지는지 보는 문장이다.')

    const justify = page.getByRole('button', { name: '양쪽 맞춤' })
    await expect(justify).toHaveCount(1)
    await justify.click()
    const para = page.locator('.ProseMirror p').last()
    expect(await para.evaluate((el) => getComputedStyle(el).textAlign)).toBe('justify')
  })
  test('워드 색판 — 테마 색과 표준 색으로 채운다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'fill' } })))

    // 테마 색 10줄 × 6단계 + 표준 색 10 (워드와 같은 구성)
    await expect(page.locator('.jan-tblfmt-theme button')).toHaveCount(60)
    await expect(page.locator('.jan-tblfmt-std button')).toHaveCount(10)

    await page.locator('.jan-tblfmt-std button').nth(3).click() // 노랑
    const bg = await page.locator('.ProseMirror table td').first().evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toBe('rgb(255, 255, 0)')
  })

  test('테마 테두리와 대각선', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } })))

    await expect(page.locator('.jan-tblfmt-presets button')).toHaveCount(12)
    await page.locator('.jan-tblfmt button', { hasText: '하향 대각선' }).click()
    await expect(page.locator('.ProseMirror table td').first()).toHaveAttribute('data-diag', 'down')
  })

  test('표 그리기(연필)로 변을 긋고 Esc 로 끝낸다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(250)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } })))
    await page.locator('.jan-tblfmt button', { hasText: '표 그리기' }).click()
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('jan-pen-draw'))).toBe(true)

    // 가운데 칸의 위쪽 변을 누른다
    const cell = page.locator('.ProseMirror table td').nth(4)
    const box = await cell.boundingBox()
    if (!box) throw new Error('칸을 못 찾았다')
    await page.mouse.click(box.x + box.width / 2, box.y + 2)
    await expect(cell).toHaveAttribute('data-bt', /solid/)

    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('jan-pen-draw'))).toBe(false)
  })

  test('지우개는 그은 변을 지운다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.locator('.jan-object-bar button', { hasText: '모든 선' }).click()
    const cell = page.locator('.ProseMirror table td').nth(0)
    await expect(cell).toHaveAttribute('data-bt', /solid/)

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'border' } })))
    await page.locator('.jan-tblfmt button', { hasText: '지우개' }).click()
    const box = await cell.boundingBox()
    if (!box) throw new Error('칸을 못 찾았다')
    await page.mouse.click(box.x + box.width / 2, box.y + 2)
    await expect(cell).toHaveAttribute('data-bt', 'none')
    await page.keyboard.press('Escape')
  })

  test('눈금선 보기를 켜면 테두리 없는 표에도 안내선이 보인다', async ({ page }) => {
    await tableEditor(page)
    await page.evaluate(() => window.dispatchEvent(new Event('jan-table-gridlines')))
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('jan-table-gridlines'))).toBe(true)
    const outline = await page.locator('.ProseMirror table td').first().evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).toBe('dashed')
  })

  test('셀 삭제는 오른쪽 칸을 당겨 온다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(250)
    await page.keyboard.press('Alt+s')

    await page.getByRole('tab', { name: '레이아웃', exact: true }).dispatchEvent('click')
    await page.waitForTimeout(200)
    // 워드처럼 「삭제 ▾」 안에 들어 있다
    await page.locator('.jan-ribbon-split[aria-label="삭제"]').click()
    await page.locator('.jan-ribbon-dropdown button', { hasText: '왼쪽으로 밀기' }).click()

    const rows = page.locator('.ProseMirror table tr')
    await expect(rows.nth(0)).toHaveText('BC')
    await expect(rows.nth(1)).toHaveText('DEF')
  })

  test('칸 글자 방향을 세로쓰기로 바꾼다', async ({ page }) => {
    await tableEditor(page)
    await pickFourCells(page)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-table-format', { detail: { tab: 'align' } })))
    await page.locator('.jan-tblfmt button', { hasText: '가로 ↔ 세로쓰기' }).click()

    const cell = page.locator('.ProseMirror table td').first()
    await expect(cell).toHaveAttribute('data-text-dir', 'vertical')
    const mode = await cell.evaluate((el) => getComputedStyle(el).writingMode)
    expect(mode).toContain('vertical')
  })
})
