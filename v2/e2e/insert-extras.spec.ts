import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 입력 탭의 나머지 — 문자표(워드 「기호」·한글 「문자표」),
 * 개체 목록(워드 「선택 창」), 표지와 빈 쪽.
 */

async function freshEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

test.describe('입력 — 문자표와 개체 목록', () => {
  test('문자표는 이름·코드로 찾고 키보드로 넣는다', async ({ page }) => {
    const editor = await freshEditor(page)
    await page.evaluate(() => window.dispatchEvent(new Event('jan-symbol-panel')))

    const dlg = page.locator('.jan-symdlg')
    await expect(dlg).toBeVisible()
    await expect(page.locator('.jan-shapedlg-groups button')).toHaveCount(10)

    // 한국어 이름으로
    await page.locator('#jan-sym-q').fill('시그마')
    await expect(page.locator('.jan-symdlg-main button')).toHaveText(['∑'])

    // 영어 이름으로도
    await page.locator('#jan-sym-q').fill('infinity')
    await expect(page.locator('.jan-symdlg-main button').first()).toHaveText('∞')

    // 코드로 (U+2190 = ←)
    await page.locator('#jan-sym-q').fill('U+2190')
    await expect(page.locator('.jan-symdlg-main button').first()).toHaveText('←')

    // 아래 화살표로 내려가 Enter 로 넣는다
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(editor).toContainText('←')
  })

  test('최근에 쓴 문자가 맨 위에 남는다', async ({ page }) => {
    await freshEditor(page)
    await page.evaluate(() => window.dispatchEvent(new Event('jan-symbol-panel')))
    await page.locator('#jan-sym-q').fill('무한')
    await page.locator('.jan-symdlg-main button').first().click()

    await page.locator('#jan-sym-q').fill('')
    await expect(page.locator('.jan-symdlg-cap')).toHaveText('최근에 쓴 것')
    await expect(page.locator('.jan-symdlg-grid').first().locator('button').first()).toHaveText('∞')
  })

  test('개체 목록은 Alt+F10 으로 여닫고 개체를 고른다', async ({ page }) => {
    await freshEditor(page)
    // 도형을 하나 넣는다
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } })))
    await expect(page.locator('.jan-shapedlg-grid button').first()).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.ProseMirror .jan-shape')).toHaveCount(1)

    await page.keyboard.press('Alt+F10')
    const pane = page.locator('.jan-objpane')
    await expect(pane).toBeVisible()
    await expect(pane.locator('.jan-objpane-row')).toHaveCount(1)
    await expect(pane.locator('.jan-objpane-kind')).toHaveText('도형')

    // 골라 보면 그 개체가 선택된다
    await pane.locator('.jan-objpane-row > button').first().click()
    await expect(page.locator('.ProseMirror .jan-shape.ProseMirror-selectednode')).toHaveCount(1)

    await page.keyboard.press('Alt+F10')
    await expect(pane).toHaveCount(0)
  })

  test('표지는 맨 앞에 들어가고 본문은 다음 쪽으로 밀린다', async ({ page }) => {
    const editor = await freshEditor(page)
    await page.keyboard.type('본문 첫 줄')

    await page.getByRole('tab', { name: '입력', exact: true }).dispatchEvent('click')
    await page.waitForTimeout(150)
    /* 리본에 나와 있으면 그대로, 접혀 있으면 「쪽 더보기」를 열고 누른다 */
    // 리본 단추에 보이는 글자는 짧은 이름이고, 긴 이름은 aria-label 에 있다
    const primary = page.locator('.jan-ribbon-body button[aria-label^="표지: 단정한"]').first()
    if (await primary.count()) {
      await primary.dispatchEvent('click')
    } else {
      const item = page.locator('.jan-ribbon-dropdown button').filter({ hasText: /표지: 단정한/ }).first()
      for (let tries = 0; tries < 4 && (await item.count()) === 0; tries += 1) {
        await page.locator('.jan-ribbon-body button[aria-label="쪽 더보기"]').dispatchEvent('click')
        await page.waitForTimeout(250)
      }
      await expect(item).toHaveCount(1)
      await item.dispatchEvent('click')
    }

    const modal = page.locator('.jan-prompt-modal')
    await expect(modal).toBeVisible()
    await modal.locator('input, textarea').first().fill('우주센서 주차 개선')
    await modal.getByRole('button', { name: '확인' }).click()
    await page.waitForTimeout(250)
    await modal.locator('input, textarea').first().fill('부제')
    await modal.getByRole('button', { name: '확인' }).click()
    await page.waitForTimeout(250)
    await modal.locator('input, textarea').first().fill('홍길동')
    await modal.getByRole('button', { name: '확인' }).click()

    await expect(editor).toContainText('우주센서 주차 개선')
    await expect(editor).toContainText('본문 첫 줄')
    // 표지 뒤에 쪽 나눔이 들어간다
    await expect(page.locator('.ProseMirror [data-page-break]')).toHaveCount(1)
  })
})
