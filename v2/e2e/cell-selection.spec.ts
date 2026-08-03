import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 칸 선택 — 워드의 표 선택 규칙을 따르는지.
 * 고른 칸이 명령 한 번에 풀려 버리면 크기를 조금씩 맞출 수 없다.
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
      '<tr><td><p>G</p></td><td><p>H</p></td><td><p>I</p></td></tr></tbody></table><p>표 뒤 문단</p>')
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.ProseMirror table td')).toHaveCount(9)
  // 표가 자리를 잡을 때까지 — 손잡이가 다시 그려지는 사이에 누르면 다른 칸이 잡힌다
  await page.waitForTimeout(900)
  return editor
}

const picked = (page: Page) => page.locator('.ProseMirror .selectedCell')

/** 칸을 눌러 커서를 그 안에 둔다 — 눌린 뒤 커서가 들어갈 때까지 기다린다 */
async function clickCell(page: Page, index: number) {
  const cell = page.locator('.ProseMirror table td').nth(index)
  const want = (await cell.textContent())?.trim() ?? ''
  await cell.click()
  await expect.poll(async () => page.evaluate(() => {
    const s = window.getSelection()
    const n = s?.anchorNode
    const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement)
    return el?.closest('td')?.textContent?.trim() ?? ''
  })).toBe(want)
  /* 화면 선택이 편집기 상태로 옮겨 붙을 때까지 — 누른 직후에는 아직 이전 자리다 */
  await page.waitForTimeout(250)
}

test.describe('표 칸 선택', () => {
  test('Alt+S 로 칸 하나를 고르고 Shift+방향키로 넓힌다', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 4) // E

    await page.keyboard.press('Alt+s')
    await expect(picked(page)).toHaveText(['E'])

    await page.keyboard.press('Shift+ArrowRight')
    await expect(picked(page)).toHaveText(['E', 'F'])

    await page.keyboard.press('Shift+ArrowDown')
    await expect(picked(page)).toHaveText(['E', 'F', 'H', 'I'])

    // 반대로 누르면 다시 좁아진다 (붙잡은 자리는 그대로)
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(picked(page)).toHaveText(['E', 'H'])
  })

  test('크기를 거듭 고쳐도 고른 칸이 풀리지 않는다', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 0)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await expect(picked(page)).toHaveCount(4)

    // 열 너비를 네 번 늘려도 선택은 그대로
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Alt+ArrowRight')
      await expect(picked(page)).toHaveCount(4)
    }
    // 행 높이도 마찬가지
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Alt+ArrowDown')
      await expect(picked(page)).toHaveCount(4)
    }
    // 같게 맞추기 뒤에도 남는다
    await page.keyboard.press('Alt+e')
    await expect(picked(page)).toHaveCount(4)
  })

  test('Shift+클릭은 두 칸 사이를 네모로 고른다', async ({ page }) => {
    await tableEditor(page)
    const cells = page.locator('.ProseMirror table td')
    await clickCell(page, 0)
    await cells.nth(8).click({ modifiers: ['Shift'] })
    await expect(picked(page)).toHaveCount(9)
  })

  test('Esc 는 선택을 풀고 커서로 돌아간다', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 0)
    await page.keyboard.press('Alt+a') // 표 전체
    await expect(picked(page)).toHaveCount(9)

    await page.keyboard.press('Escape')
    await expect(picked(page)).toHaveCount(0)
    // 커서는 표 안에 남는다 — 이어서 칸을 다시 고를 수 있다
    await page.keyboard.press('Alt+s')
    await expect(picked(page)).toHaveCount(1)
  })

  test('Delete 는 고른 칸의 글만 지우고 칸은 남긴다', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 0)
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Shift+ArrowRight')

    await page.keyboard.press('Delete')
    await expect(page.locator('.ProseMirror table td')).toHaveCount(9)
    await expect(page.locator('.ProseMirror table td').nth(0)).toHaveText('')
    await expect(page.locator('.ProseMirror table td').nth(2)).toHaveText('C')
  })

  /**
   * 표 **전체**를 고르고 Delete — 워드는 칸을 남기고 내용만 비운다.
   *
   * 실측(고치기 전): Alt+A 로 아홉 칸을 모두 고르고 Delete 를 누르면
   * table 1→0 · td 9→0 · 「A|B|C|D|E|F|G|H|I」→「」 — 표가 통째로 사라졌다.
   * (tiptap 표 확장이 「모든 칸이 골라졌으면 표를 지운다」 를 Delete 에 걸어 둔 탓)
   * 일부 칸만 골랐을 때는 그때도 내용만 비웠다 — 그러니 이 시험은 전체 고름만 본다.
   */
  test('표 전체를 골라 Delete 해도 표는 남고 내용만 빈다', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 4)
    await page.keyboard.press('Alt+a')
    await expect(picked(page)).toHaveCount(9)

    await page.keyboard.press('Delete')
    await expect(page.locator('.ProseMirror table')).toHaveCount(1)
    await expect(page.locator('.ProseMirror table td')).toHaveCount(9)
    await expect(page.locator('.ProseMirror table td')).toHaveText(['', '', '', '', '', '', '', '', ''])
    // 비운 뒤에도 고른 네모는 그대로다 — 이어서 서식을 줄 수 있다
    await expect(picked(page)).toHaveCount(9)

    // 되돌리기 **한 번**으로 아홉 칸이 모두 돌아온다
    await page.keyboard.press('Control+z')
    await expect(page.locator('.ProseMirror table td')).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  })

  /* 표를 지우는 길은 남아 있어야 한다 — 워드도 Delete 는 비우고 Backspace 는 지운다 */
  test('표 전체를 골라 Backspace 하면 표가 지워진다 (되돌리기 한 번으로 복구)', async ({ page }) => {
    await tableEditor(page)
    await clickCell(page, 4)
    await page.keyboard.press('Alt+a')
    await expect(picked(page)).toHaveCount(9)

    await page.keyboard.press('Backspace')
    await expect(page.locator('.ProseMirror table')).toHaveCount(0)

    await page.keyboard.press('Control+z')
    await expect(page.locator('.ProseMirror table td')).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  })

  test('표 밖에서는 Alt+S 가 도형을 고르는 데로 돌아간다', async ({ page }) => {
    await tableEditor(page)
    // 표 뒤 문단으로 나간 뒤 도형을 하나 넣는다
    await page.keyboard.press('Control+End')
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } })))
    await expect(page.locator('.jan-shapedlg-grid button').first()).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.ProseMirror .jan-shape')).toHaveCount(1)

    await page.keyboard.press('Alt+s')
    await expect(page.locator('.ProseMirror .jan-shape.ProseMirror-selectednode')).toHaveCount(1)
  })
  test('떠 있는 서식 막대가 표를 덮지 않는다', async ({ page }) => {
    await tableEditor(page)

    // 칸을 고르면 막대는 뜨지 않는다 — 뜨면 다음 칸을 누를 때 막대의 단추가 눌린다
    await clickCell(page, 0)
    await page.keyboard.press('Alt+s')
    await expect(picked(page)).toHaveCount(1)
    await expect(page.locator('.jan-bubble-toolbar')).toHaveCount(0)

    // 칸 안의 글만 골랐을 때는 뜨되, 표 위쪽 바깥에 자리 잡는다
    await clickCell(page, 4)
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    const bubble = page.locator('.jan-bubble-toolbar')
    await expect(bubble).toBeVisible()
    const [barBottom, tableTop] = await page.evaluate(() => {
      const bar = document.querySelector('.jan-bubble-toolbar') as HTMLElement
      const table = document.querySelector('.ProseMirror table') as HTMLElement
      return [bar.getBoundingClientRect().bottom, table.getBoundingClientRect().top]
    })
    expect(barBottom).toBeLessThanOrEqual(tableTop + 1)
  })
  test('칸 왼쪽 끝을 누르면 그 칸 하나가 선택된다 — 워드와 같은 자리', async ({ page }) => {
    await tableEditor(page)
    const cell = page.locator('.ProseMirror table td').nth(4) // E
    const box = await cell.boundingBox()
    if (!box) throw new Error('칸을 찾지 못했다')

    // 왼쪽 안쪽 끝(4px 안)을 누른다
    await page.mouse.click(box.x + 4, box.y + box.height / 2)
    await expect(picked(page)).toHaveText(['E'])

    // 같은 칸의 가운데를 누르면 글을 쓰는 커서로 돌아간다
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(picked(page)).toHaveCount(0)
  })

  test('세 번 클릭해도 칸 하나가 선택된다', async ({ page }) => {
    await tableEditor(page)
    await page.locator('.ProseMirror table td').nth(4).click({ clickCount: 3 })
    await expect(picked(page)).toHaveText(['E'])
  })
})
