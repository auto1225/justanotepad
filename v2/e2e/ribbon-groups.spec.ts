import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 리본 묶음 — 워드처럼 이름 붙은 묶음, 펼침 단추(▾), 색·선 고르개.
 * 표를 고르면 표 탭이 저절로 떠야 하고, 펼친 차림표가 가려지면 안 된다.
 */

async function tableEditor(page: Page) {
  await page.setViewportSize({ width: 1600, height: 950 })
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
      '<tr><td><p>D</p></td><td><p>E</p></td><td><p>F</p></td></tr></tbody></table><p>뒤 문단</p>')
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.ProseMirror table td')).toHaveCount(6)
  await page.waitForTimeout(900)
  return editor
}

test.describe('리본 묶음', () => {
  test('표 안을 누르면 표 탭이 저절로 뜬다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(3).click()

    // 표 탭이 나타나고 그 중 하나가 골라져 있다 (예전에는 없는 탭 이름이라 파일 탭으로 떨어졌다)
    await expect(page.getByRole('tab', { name: '표 디자인', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: '레이아웃', exact: true })).toHaveAttribute('aria-selected', 'true')

    // 표 밖으로 나가면 쓰던 탭으로 돌아온다
    await page.keyboard.press('Control+End')
    await expect(page.getByRole('tab', { name: '레이아웃', exact: true })).toHaveCount(0)
  })

  test('묶음마다 이름이 붙어 있다 — 워드와 같은 구성', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(300)

    await expect(page.locator('.jan-ribbon-cap')).toHaveText(['표', '그리기', '행 및 열', '병합', '셀 크기', '맞춤', '데이터'])

    await page.getByRole('tab', { name: '표 디자인', exact: true }).click()
    await expect(page.locator('.jan-ribbon-cap')).toHaveText(['표 스타일 옵션', '표 스타일', '음영', '테두리'])
  })

  test('펼친 차림표가 가려지지 않고 보인다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(300)

    await page.locator('.jan-ribbon-split[aria-label="선택"]').click()
    const pop = page.locator('.jan-ribbon-dropdown')
    await expect(pop).toBeVisible()

    // 화면 안에 있고, 그 자리를 다른 것이 덮고 있지 않다
    const covered = await pop.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + 10)
      return { inView: r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth, mine: !!top?.closest('.jan-ribbon-dropdown') }
    })
    expect(covered.inView).toBe(true)
    expect(covered.mine).toBe(true)
  })

  test('음영·펜 색은 워드 색판으로 고른다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Alt+s')
    await page.getByRole('tab', { name: '표 디자인', exact: true }).click()

    await page.locator('.jan-ribbon-split[aria-label^="음영"]').click()
    // 테마 색 10줄 × 6단계 + 표준 색 10 + 색 없음 + 다른 색 (워드와 같은 구성)
    await expect(page.locator('.jan-wcolor-theme button')).toHaveCount(60)
    await expect(page.locator('.jan-wcolor-std button')).toHaveCount(10)
    await expect(page.locator('.jan-wcolor-none')).toHaveCount(1)
    await expect(page.locator('.jan-wcolor-more')).toHaveCount(1)

    await page.locator('.jan-wcolor-std button').nth(1).click() // 빨강
    const bg = await page.locator('.ProseMirror table td').first().evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).toBe('rgb(255, 0, 0)')
  })

  test('펜 두께·모양을 고른 대로 테두리가 그어진다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Alt+s')
    await page.getByRole('tab', { name: '표 디자인', exact: true }).click()

    await page.locator('.jan-ribbon-split[aria-label="펜 두께"]').click()
    await expect(page.locator('.jan-wline-label').first()).toHaveText('½ pt')
    await page.locator('.jan-wline button').nth(4).click() // 2¼ pt = 3px

    await page.locator('.jan-ribbon-split[aria-label="펜 모양"]').click()
    await page.locator('.jan-wline button').nth(1).click() // 파선

    await page.locator('.jan-ribbon-split[aria-label="펜 색"]').click()
    await page.locator('.jan-wcolor-std button').nth(7).click() // 파랑 #0070c0

    await page.locator('.jan-ribbon-split[aria-label="테두리"]').click()
    await page.locator('.jan-ribbon-dropdown button', { hasText: '모든 테두리' }).click()

    const cell = page.locator('.ProseMirror table td').first()
    await expect(cell).toHaveAttribute('data-bt', '3|dashed|#0070c0')
    expect(await cell.evaluate((el) => getComputedStyle(el).borderTop)).toBe('3px dashed rgb(0, 112, 192)')
  })

  test('맞춤은 아홉 칸 격자로 고른다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(0).click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Alt+s')

    const grid = page.locator('.jan-ribbon-grid .jan-ribbon-gridbtn')
    await expect(grid).toHaveCount(9)
    await grid.nth(8).click() // 아래 오른쪽
    const cell = page.locator('.ProseMirror table td').first()
    await expect(cell).toHaveAttribute('data-valign', 'bottom')
    expect(await cell.locator('p').evaluate((el) => getComputedStyle(el).textAlign)).toBe('right')
  })
})
