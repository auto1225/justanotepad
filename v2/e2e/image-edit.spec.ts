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

test('그림 막대는 하나뿐이고, 손잡이를 끌면 실제로 크기가 바뀐다', async ({ page }) => {
  /* 지난번 시험은 「도구막대가 뜬다」 까지만 보고 통과했다. 그런데 막대가 둘이라 서로 겹쳐
     손잡이를 가렸고, 쓰는 사람은 크기를 못 바꿨다. 눌러서 뜨는 것 말고 「정말 바뀌는가」 를 본다. */
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await putImage(page)
  await expect(doc.locator('img')).toHaveCount(1)
  await doc.locator('img').first().click()

  /* 그림 막대는 하나뿐이다 — 둘이면 서로 겹쳐 손잡이를 가린다 */
  await expect(page.locator('.jan-object-bar')).toHaveCount(1)
  await expect(page.locator('.jan-image-menu')).toHaveCount(0)

  /* 손잡이가 막대에 가리지 않는다 */
  const dots = page.locator('.jan-img-handles .jan-ih-dot')
  await expect(dots.first()).toBeVisible()
  const covered = await page.evaluate(() => {
    const bad: string[] = []
    document.querySelectorAll('.jan-img-handles .jan-ih-dot').forEach((d, i) => {
      const r = d.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (hit && hit.closest('.jan-object-bar')) bad.push(String(i))
    })
    return bad
  })
  expect(covered).toEqual([])

  /* 오른쪽 아래 손잡이를 안쪽으로 끌면 그림이 작아진다 */
  const before = await doc.locator('img').first().boundingBox()
  let best: { x: number; y: number; width: number; height: number } | null = null
  const n = await dots.count()
  for (let i = 0; i < n; i += 1) {
    const b = await dots.nth(i).boundingBox()
    if (b && (!best || b.x + b.y > best.x + best.y)) best = b
  }
  expect(best).not.toBeNull()
  await page.mouse.move(best!.x + best!.width / 2, best!.y + best!.height / 2)
  await page.mouse.down()
  for (let k = 1; k <= 6; k += 1) await page.mouse.move(best!.x - k * 25, best!.y - k * 16)
  await page.mouse.up()
  await page.waitForTimeout(600)

  const after = await doc.locator('img').first().boundingBox()
  expect(after!.width).toBeLessThan(before!.width - 40)
})
