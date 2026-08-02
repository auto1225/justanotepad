import { test, expect } from '@playwright/test'

/**
 * 판 번호는 늘 보이는 자리에 있어야 한다.
 *
 * 무엇이 도는 중인지 묻지 않고 알 수 있어야 하고, 사람이 「고쳤다는데 안 바뀐다」 고 할 때
 * 먼저 볼 곳이기도 하다. 그리고 화면과 「앱 정보」 가 다른 번호를 말하면 안 된다 —
 * 예전에는 앱 정보에만 2.0.0 이 박혀 있고 화면에는 아무 데도 없었다.
 */

test('상태줄에 판 번호가 보이고, 앱 정보와 같은 번호를 말한다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })

  /* 상태줄에 V<큰 자리>.<세 자리> 꼴이 보인다 */
  const bar = page.locator('.jan-statusbar')
  await expect(bar).toContainText(/V\d+\.\d{3}/)
  const shown = (await bar.innerText()).match(/V\d+\.\d{3}/)?.[0] || ''
  expect(shown).not.toBe('')

  /* 앱 정보 창도 같은 번호다 */
  await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="앱 정보 · 버전"]').first().click()
  const about = page.locator('.jan-modal-overlay').last()
  await expect(about).toBeVisible()
  await expect(about).toContainText(shown)
})
