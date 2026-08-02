import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * 개체를 고르면 뜨는 도구막대가 리본을 덮지 않아야 한다.
 *
 * 덮으면 그림을 하나 넣은 뒤 다음 명령이 눌리지 않는다 — 그림 여럿을 넣는 문서(강의 노트)에서
 * 두 번째부터 막혔다. 화면 위쪽 개체에서 막대를 8px 에 붙이던 것이 원인이었다.
 */

const PNG = path.join(process.cwd(), 'e2e', 'fixtures', 'dot.png')

test('그림을 골라도 리본은 계속 눌린다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('그림을 넣어 본다')

  /* 문서 맨 위에 그림을 넣는다 — 개체가 화면 위쪽에 놓이는 자리다 */
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(PNG)
  await expect(doc.locator('img')).toHaveCount(1)

  /* 그림을 골라 도구막대를 띄운다 */
  await doc.locator('img').first().click()
  const bar = page.locator('.jan-object-bar')
  await expect(bar).toBeVisible()

  /* 막대가 리본보다 아래에 있다 — 겹치면 리본이 눌리지 않는다 */
  const barBox = await bar.boundingBox()
  const ribbonBox = await page.locator('.jan-ribbon-body').first().boundingBox()
  expect(barBox).not.toBeNull()
  expect(ribbonBox).not.toBeNull()
  expect(barBox!.y).toBeGreaterThanOrEqual(ribbonBox!.y + ribbonBox!.height)

  /* 그리고 리본의 단추 자리를 손가락이 실제로 짚을 수 있다 —
     겹쳐 있으면 그 점에서 잡히는 것이 막대가 되어, 눌러도 막대가 눌린다 */
  const covered = await page.evaluate(() => {
    const body = document.querySelector('.jan-ribbon-body')
    if (!body) return 'no-ribbon'
    const r = body.getBoundingClientRect()
    /* 리본 띠를 가로로 훑어 본다 — 한 점이라도 막대가 잡히면 그 자리는 못 누른다 */
    for (let i = 1; i < 10; i += 1) {
      const hit = document.elementFromPoint(r.left + (r.width * i) / 10, r.top + r.height / 2)
      if (hit?.closest('.jan-object-bar')) return 'covered-by-bar'
    }
    return 'reachable'
  })
  expect(covered).toBe('reachable')
})
