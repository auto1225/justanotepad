import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * 그림을 한 번 누르면 「고르기」 여야 한다 — 워드도 한글도 그렇다.
 *
 * 예전에는 한 번만 눌러도 크게 보기가 뜨고, 그 자리에서 preventDefault 를 해 버려
 * 고르기 자체가 일어나지 않았다. 그래서 그림을 고쳐 보려던 사람은 난데없이 전체 화면을
 * 만나고, 닫고 나서도 손잡이가 말을 듣지 않았다. 배치 · 자르기 · 캡션 같은 기능이
 * 다 들어 있는데도 그 입구가 막혀 있던 셈이다.
 */

const IMG = path.join(process.cwd(), 'e2e', 'fixtures', 'wide.png')

async function putImage(page: import('@playwright/test').Page) {
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(IMG)
}

test('한 번 누르면 골라지고 도구막대가 뜬다 — 크게 보기가 아니다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await putImage(page)
  await expect(doc.locator('img')).toHaveCount(1)

  await doc.locator('img').first().click()

  /* 크게 보기는 뜨지 않는다 */
  await expect(page.locator('.jan-lightbox')).toHaveCount(0)
  /* 대신 개체 도구막대가 뜬다 — 여기서 배치 · 자르기 · 캡션으로 간다 */
  const bar = page.locator('.jan-object-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('배치')
  await expect(bar).toContainText('자르기')
})

test('두 번 누르면 크게 보기가 열린다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await putImage(page)
  await expect(doc.locator('img')).toHaveCount(1)

  await doc.locator('img').first().dblclick()
  await expect(page.locator('.jan-lightbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.jan-lightbox')).toHaveCount(0)
})
