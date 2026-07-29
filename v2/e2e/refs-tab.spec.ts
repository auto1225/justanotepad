import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 자료 탭 — 워드 「참조」 자리.
 * 목차·미주·인용/참고 문헌·캡션 목차·색인·근거 목차가 실제로 심어지고,
 * 문서가 바뀐 뒤 「고쳐 넣기」 를 누르면 그 자리에서 새로 만들어져야 한다.
 */

async function ready(page: Page, html = '<h1>첫 장</h1><p>본문 하나</p><h2>둘째 절</h2><p>주차 정보가 흐른다</p>') {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    localStorage.removeItem('jan-v2-sources')
  })
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.evaluate((source) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', source)
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, html)
  await expect(editor.locator('h1')).toHaveCount(1)
  await page.waitForTimeout(500)
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  return editor
}

/** 앱의 물음 창에 답한다 */
async function answer(page: Page, value: string) {
  const modal = page.locator('.jan-prompt-modal')
  await expect(modal).toBeVisible()
  await modal.locator('input, textarea').first().fill(value)
  await modal.getByRole('button', { name: '확인' }).click()
  await page.waitForTimeout(250)
}

test.describe('자료 탭', () => {
  test('묶음이 워드 「참조」 와 같은 차례로 나뉜다', async ({ page }) => {
    await ready(page)
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps.slice(0, 6)).toEqual(['목차', '각주 · 미주', '인용 · 참고 문헌', '캡션', '색인', '근거 목차'])
  })

  test('목차는 제목에서 만들어지고, 제목이 바뀌면 그 자리에서 새로 만들어진다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="목차 넣기"]').first().click()

    const rows = page.locator('.ProseMirror [data-jan-field="toc"]')
    await expect(rows).toHaveCount(3)                    // 머리글 + 제목 둘
    await expect(rows.nth(1)).toContainText('첫 장')

    // 제목을 고치고 다시 누르면 목차가 둘로 늘지 않고 그 자리에서 바뀐다
    await editor.locator('h1').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 고침')
    await page.locator('button[aria-label^="목차 넣기"]').first().click()
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText('첫 장 고침')
  })

  test('미주는 문서 끝에 모이고 표식이 함께 생긴다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').last().click()
    await page.keyboard.press('End')
    await page.locator('button[aria-label^="미주 삽입"]').first().click()

    await expect(page.locator('.ProseMirror .jan-en-ref')).toHaveCount(1)
    await expect(page.locator('.ProseMirror [data-jan-field="endnote"]')).toHaveCount(2) // 머리글 + 한 줄
  })

  test('색인은 표시한 말만 모으고 쪽 번호를 붙인다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').last().click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight')

    await page.locator('button[aria-label^="색인 항목 표시"]').first().click()
    await answer(page, '주차')
    await expect(page.locator('.ProseMirror [data-index]')).toHaveCount(1)

    await page.locator('button[aria-label^="색인 넣기"]').first().click()
    const rows = page.locator('.ProseMirror [data-jan-field="index"]')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('주차')
  })

  test('출처를 넣으면 인용과 참고 문헌이 그 표기 방식으로 만들어진다', async ({ page }) => {
    await ready(page)
    await page.locator('button[aria-label^="출처 관리"]').first().click()
    const dialog = page.locator('.jan-srcdlg')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '새 출처' }).click()
    await dialog.locator('input[aria-label="저자"]').fill('홍길동')
    await dialog.locator('input[aria-label="제목"]').fill('레이더 주차 감지')
    await dialog.locator('input[aria-label="연도"]').fill('2026')
    await expect(dialog.locator('.jan-srcdlg-preview')).toContainText('(홍길동, 2026)')   // APA

    // 표기 방식을 IEEE 로 바꾸면 참고 문헌 모양이 번호식으로 바뀐다
    await dialog.locator('select[aria-label="표기 방식"]').selectOption('IEEE')
    await expect(dialog.locator('.jan-srcdlg-preview')).toContainText('[1] 홍길동')

    await dialog.getByRole('button', { name: '참고 문헌 목록 넣기' }).click()
    const bib = page.locator('.ProseMirror [data-jan-field="bib"]')
    await expect(bib).toHaveCount(2)
    await expect(bib.nth(1)).toContainText('레이더 주차 감지')
  })

  test('근거(법령·판례)를 표시하면 근거 목차가 갈래별로 만들어진다', async ({ page }) => {
    const editor = await ready(page)
    await editor.locator('p').first().click()
    await page.keyboard.press('Home')
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight')

    await page.locator('button[aria-label^="근거 표시"]').first().click()
    await answer(page, '주차장법 제6조')
    await answer(page, '법령')
    await expect(page.locator('.ProseMirror [data-authority]')).toHaveCount(1)

    await page.locator('button[aria-label^="근거 목차"]').first().click()
    const rows = page.locator('.ProseMirror [data-jan-field="auth"]')
    await expect(rows.first()).toContainText('근거 목차')
    await expect(rows.filter({ hasText: '주차장법 제6조' })).toHaveCount(1)
  })
})
