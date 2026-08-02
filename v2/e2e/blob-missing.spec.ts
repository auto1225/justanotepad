import { test, expect } from '@playwright/test'

/**
 * 저장소에 알맹이가 없는 그림 주소를 만나면, 되풀이해 부르지 않아야 한다.
 *
 * 실제로 쓰는 사람의 콘솔에 같은 요청이 7,000건 넘게 쌓여 있었다
 * (GET jan-blob://… net::ERR_UNKNOWN_URL_SCHEME). 브라우저가 못 읽는 주소를 그대로 두니
 * 부르고 → 실패하고 → 다시 그리고 → 또 부르기를 끝없이 되풀이했다.
 * 화면이 떨린 것이 이것이다. 그리고 그림은 아무 말 없이 사라져 있었다.
 */

const REF = 'jan-blob://no-such-blob-for-test'

test('없는 그림 주소를 끝없이 다시 부르지 않고, 빈자리를 보여 준다', async ({ page }) => {
  const asked: string[] = []
  page.on('console', (m) => { const t = m.text(); if (t.includes('jan-blob://')) asked.push(t) })
  page.on('requestfailed', (r) => { if (r.url().startsWith('jan-blob://')) asked.push(r.url()) })

  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('없는 그림을 가리키는 문서')

  /* 저장소에 없는 주소로 그림을 넣는다 — 알맹이를 잃은 문서와 같은 상태 */
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"] .jan-ribbon-caret').first().click()
  await page.locator('button', { hasText: /인터넷 주소/ }).first().click()
  const ask = page.locator('.jan-modal-overlay').last()
  await ask.locator('input, textarea').first().fill(REF)
  await ask.getByRole('button', { name: '확인' }).first().click()
  await expect(doc.locator('img')).toHaveCount(1)

  /* 잠깐 두고 본다 — 되풀이가 있으면 여기서 수백 건이 쌓인다 */
  await page.waitForTimeout(4000)

  /* 빈자리를 보여 준다 — 조용히 사라지지 않는다 */
  await expect(doc.locator('img[data-jan-blob-missing]')).toHaveCount(1)

  /* 그리고 아예 부르지 않는다 — 브라우저가 못 읽는 주소는 화면에 붙이지 않는다 */
  expect(asked.length).toBe(0)

  /* 주소는 잃지 않는다 — 저장하면 다시 살릴 수 있어야 한다 */
  const kept = await doc.locator('img').first().getAttribute('data-blob-ref')
  expect(kept).toBe(REF)
})
