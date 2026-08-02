import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

/**
 * 그림이 든 문서에서 쪽이 제대로 나뉘어야 한다.
 *
 * 쪽 나눔은 「문서가 바뀔 때」 만 돌았다. 그런데 그림은 문서가 바뀌지 않은 채로 나중에
 * 불러와지며 높이가 0 에서 제 크기로 커진다. 그 사이에 짜 놓은 쪽은 그림을 0 으로 재고
 * 만든 것이라 — 뒤따르는 글이 아래 여백을 뚫거나, 넘친 자리를 정리하는 과정에서
 * 그림이 통째로 사라졌다. 둘 다 실제로 나온 증상이다.
 */

const IMG = path.join(process.cwd(), 'e2e', 'fixtures', 'wide.png')
/* 그림이 「늦게 오는」 상황을 그대로 만든다 — 이 사이가 바로 문제가 나던 자리다.
   파일에서 넣으면 곧바로 오므로 재현되지 않는다. 주소로 넣고 응답을 늦춘다. */
const SLOW = 'https://example.invalid/slow-wake.png'

test('그림을 넣고 글을 더 쳐도 그림이 남아 있고, 글이 아래 여백을 뚫지 않는다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()

  /* 한 쪽을 채울 만큼 글을 친다 */
  for (let i = 1; i <= 12; i += 1) {
    await page.keyboard.type(`문단 ${i} — 쪽을 채우기 위한 글이다. 그림 뒤에 오는 글이 여백을 뚫는지 본다.`)
    await page.keyboard.press('Enter')
  }

  /* 늦게 오는 그림 하나 — 주소로 넣고 응답을 900ms 늦춘다 */
  await page.route(SLOW, async (route) => {
    await new Promise((r) => setTimeout(r, 900))
    await route.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(IMG) })
  })
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"] .jan-ribbon-caret').first().click()
  await page.locator('button', { hasText: /인터넷 주소/ }).first().click()
  const ask = page.locator('.jan-modal-overlay').last()
  await ask.locator('input, textarea').first().fill(SLOW)
  await ask.getByRole('button', { name: '확인' }).first().click()
  await expect(doc.locator('img')).toHaveCount(1)

  /* 그림 뒤로 글을 더 친다 — 예전에는 이 사이에 그림이 사라졌다 */
  await doc.click()
  await page.keyboard.press('Control+End')
  for (let i = 13; i <= 24; i += 1) {
    await page.keyboard.type(`문단 ${i} — 이어지는 글.`)
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(1500)

  /* 1) 그림이 그대로 있다 */
  await expect(doc.locator('img')).toHaveCount(1)

  /* 2) 어느 쪽도 글이 본문 상자 아래를 넘지 않는다 */
  const over = await page.evaluate(() => {
    const worst: number[] = []
    document.querySelectorAll('[data-jan-page]').forEach((pg) => {
      const box = pg.getBoundingClientRect()
      const pad = parseFloat(getComputedStyle(pg).paddingBottom) || 0
      const limit = box.bottom - pad
      let w = 0
      pg.childNodes.forEach((n) => {
        if (n.nodeType !== 1) return
        const r = (n as Element).getBoundingClientRect()
        if (r.height && r.bottom > limit) w = Math.max(w, r.bottom - limit)
      })
      worst.push(Math.round(w))
    })
    return worst
  })
  /* 늘어나도 되는 쪽(한 쪽보다 큰 그림·표)은 예외라 약간의 여유는 둔다 */
  expect(Math.max(0, ...over)).toBeLessThan(4)
})
