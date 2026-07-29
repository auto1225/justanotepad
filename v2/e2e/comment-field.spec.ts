import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 메모(워드 「삽입 › 메모」)와 누름틀(한글 「입력 › 필드 입력」).
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

/** 첫 문단의 앞 n 글자를 고른다 */
async function selectFirstChars(page: Page, n: number) {
  await page.evaluate((count) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const text = pm.querySelector('p')?.firstChild
    if (!text) return
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, count)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, n)
  await page.waitForTimeout(150)
}

test.describe('메모와 누름틀', () => {
  test('Ctrl+Alt+M 으로 메모를 달고 목록에서 오간다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('우주센서 주차 관제 시스템')
    await selectFirstChars(page, 4)

    page.once('dialog', (d) => d.accept('여기 근거를 붙이자'))
    await page.keyboard.press('Control+Alt+m')

    const mark = page.locator('.ProseMirror .jan-comment')
    await expect(mark).toHaveCount(1)
    await expect(mark).toHaveText('우주센서')

    // 메모 목록이 함께 열린다
    const pane = page.locator('.jan-cmtpane')
    await expect(pane).toBeVisible()
    await expect(pane.locator('.jan-cmtpane-text')).toHaveText('여기 근거를 붙이자')

    // 끝냄으로 표시하면 자국이 흐려진다
    await pane.getByRole('button', { name: '메모 끝내기' }).click()
    await expect(page.locator('.ProseMirror .jan-comment.is-done')).toHaveCount(1)

    // 지우면 자국도 사라진다
    await pane.getByRole('button', { name: '메모 지우기' }).click()
    await expect(page.locator('.ProseMirror .jan-comment')).toHaveCount(0)
  })

  test('메모는 저장했다 다시 열어도 남는다', async ({ page }) => {
    await freshEditor(page)
    await page.keyboard.type('센서 배치 계획')
    await selectFirstChars(page, 2)
    page.once('dialog', (d) => d.accept('확인 필요'))
    await page.keyboard.press('Control+Alt+m')
    await expect(page.locator('.ProseMirror .jan-comment')).toHaveCount(1)

    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.ProseMirror .jan-comment')).toHaveCount(1)
    await expect(page.locator('.ProseMirror .jan-comment')).toHaveAttribute('data-comment', '확인 필요')
  })

  test('누름틀은 안내문을 보이다가 누르면 채워진다', async ({ page }) => {
    const editor = await freshEditor(page)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('jan-noop'))
    })
    // 리본에서 누름틀을 넣는다
    await page.getByRole('tab', { name: '삽입', exact: true }).dispatchEvent('click')
    await page.waitForTimeout(150)
    const btn = page.locator('.jan-ribbon-body button[aria-label^="누름틀 넣기"]').first()
    const item = page.locator('.jan-ribbon-dropdown button').filter({ hasText: /누름틀/ }).first()
    if (await btn.count()) {
      await btn.dispatchEvent('click')
    } else {
      for (let tries = 0; tries < 4 && (await item.count()) === 0; tries += 1) {
        await page.locator('.jan-ribbon-body button[aria-label="메모와 서식 칸 더보기"]').dispatchEvent('click')
        await page.waitForTimeout(250)
      }
      await item.dispatchEvent('click')
    }

    const modal = page.locator('.jan-prompt-modal')
    await expect(modal).toBeVisible()
    await modal.locator('input, textarea').first().fill('이름을 쓴다')
    await modal.getByRole('button', { name: '확인' }).click()
    await page.waitForTimeout(250)
    await modal.getByRole('button', { name: '확인' }).click() // 지침은 비워 둔다

    const field = page.locator('.ProseMirror .jan-field')
    await expect(field).toHaveCount(1)
    await expect(field).toHaveText('〔이름을 쓴다〕')

    // 눌러서 채운다
    page.once('dialog', (d) => d.accept('홍길동'))
    await field.click()
    await expect(field).toHaveText('홍길동')
    await expect(field).toHaveClass(/is-filled/)
    await expect(editor).toContainText('홍길동')
  })
})
