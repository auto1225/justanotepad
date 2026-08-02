import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * 그림 번호와 그것을 가리키는 참조는 문서가 바뀌면 스스로 따라가야 한다.
 *
 * 앞에 그림 하나를 끼워 넣으면 뒤의 번호가 한 칸씩 밀린다. 그런데 「번호 모두 다시 매기기」 를
 * 누를 때만 맞춰졌다 — 누르는 것을 잊으면 「그림 2에서 보듯」 이 다른 그림을 가리킨다.
 * 글이 조용히 틀리는 자리라 사람 손에 맡길 일이 아니다.
 */

const PNG = path.join(process.cwd(), 'e2e', 'fixtures', 'dot.png')

async function putImage(page: import('@playwright/test').Page) {
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(PNG)
  await page.waitForTimeout(600)
}

test('앞에 그림을 끼워 넣으면 뒤 그림의 번호가 스스로 밀린다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()

  /* 그림 하나에 캡션을 단다 — 그림 1 이 된다 */
  await putImage(page)
  await doc.click()
  await page.keyboard.press('Control+End')
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="캡션 넣기 (그림·표에 번호와 설명)"]').first().click()
  const ask = page.locator('.jan-modal-overlay').last()
  await ask.locator('input, textarea').first().fill('뒤에 오는 그림')
  await ask.getByRole('button', { name: '확인' }).first().click()
  await page.waitForTimeout(700)
  await expect(doc.locator('[data-paper-tag="figlabel"], .paper-figlabel').first()).toContainText('1')

  /* 문서 맨 앞에 그림을 하나 더 끼워 넣고 캡션을 단다 */
  await doc.click()
  await page.keyboard.press('Control+Home')
  await putImage(page)
  await doc.click()
  await page.keyboard.press('Control+Home')
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="캡션 넣기 (그림·표에 번호와 설명)"]').first().click()
  const ask2 = page.locator('.jan-modal-overlay').last()
  await ask2.locator('input, textarea').first().fill('앞에 끼운 그림')
  await ask2.getByRole('button', { name: '확인' }).first().click()

  /* 「번호 다시 매기기」 를 누르지 않아도 앞이 1, 뒤가 2 가 된다 */
  await expect(async () => {
    const labels = await doc.locator('[data-paper-tag="figlabel"], .paper-figlabel').allInnerTexts()
    expect(labels.length).toBe(2)
    expect(labels[0]).toContain('1')
    expect(labels[1]).toContain('2')
  }).toPass({ timeout: 8000 })
})
