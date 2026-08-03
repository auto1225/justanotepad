import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 전역 스타일을 바꾸면 쪽을 다시 짜는가.
 *
 * 「디자인 → 단락 간격」·「문서 서식」 은 **문서를 하나도 고치지 않는다** — CSS 변수 한 줄만
 * 바꿔 같은 글이 옷을 갈아입는다(워드와 같은 방식). 그런데 쪽 나눔은 「문서가 바뀔 때」 에만
 * 돌았으므로, 줄 간격을 넓히면 늘어난 글이 종이 밖으로 밀려나고 아무도 다시 짜지 않았다.
 * 쪽 노드는 overflow:clip 이라 밀려난 글은 **화면에서 사라진다** — 지워지지도, 다음 쪽으로
 * 가지도 않고 그냥 보이지 않는다.
 *
 * 실측(고치기 전, A4 여섯 쪽 문서에서 「두 줄 간격」 을 고름):
 *   쪽 다섯이 아래 여백을 306.8px 뚫었고, 블록 15개가 종이 밖으로 완전히 빠져 보이지 않았다.
 *   조판 트랜잭션은 3.5초 동안 0 회. 글자 하나를 치면 그제야 8회 돌며 여덟 쪽으로 바로잡혔다.
 */

const 채움 = (i: number) =>
  `<p>${i}번 문단이다. 쪽을 채우기 위한 글이며 충분히 길어야 여러 줄이 된다. 가나다라마바사아자차카타파하 ABCDEFG HIJKLMN 오이시디에프지에이치.</p>`

async function 열기(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(400)
  await page.evaluate((h) => {
    const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }
    w.__janEditor.commands.setContent(h)
  }, Array.from({ length: 90 }, (_, i) => 채움(i + 1)).join(''))
  await page.waitForTimeout(3000)
  return editor
}

/** 리본의 ▾ 단추를 열고 그 안의 항목을 고른다 */
async function 리본에서고르기(page: Page, button: string, item: string) {
  await page.locator('.jan-ribbon-tab', { hasText: /^디자인$/ }).first().click()
  await page.locator(`button[aria-label^="${button}"]`).first().click()
  await page.locator('.jan-ribbon-dropdown button', { hasText: item }).first().click()
}

/**
 * 쪽마다 「아래 여백을 뚫었는가」 와 「종이 밖으로 아주 빠져 보이지 않는 블록이 있는가」.
 * 늘어나도 되는 쪽(쪼갤 수 없는 큰 블록이 든 쪽)은 뚫는 것이 정상이므로 뺀다.
 */
async function 종이밖(page: Page) {
  return page.evaluate(() => {
    let 넘침 = 0
    let 넘친쪽 = 0
    let 안보이는블록 = 0
    document.querySelectorAll('[data-jan-page]').forEach((pg) => {
      const el0 = pg as HTMLElement
      if (el0.getAttribute('data-jan-grow') === '1') return
      const r0 = el0.getBoundingClientRect()
      const 아래 = r0.bottom - (parseFloat(getComputedStyle(el0).paddingBottom) || 0)
      let worst = 0
      Array.from(el0.children).forEach((c) => {
        const el = c as HTMLElement
        if (el.classList.contains('ProseMirror-widget')) return
        if (getComputedStyle(el).position === 'absolute') return
        const r = el.getBoundingClientRect()
        if (!r.height) return
        if (r.top >= r0.bottom) 안보이는블록 += 1
        if (r.bottom > 아래) worst = Math.max(worst, r.bottom - 아래)
      })
      if (worst > 1) { 넘친쪽 += 1; 넘침 = Math.max(넘침, worst) }
    })
    return { 넘침: Math.round(넘침), 넘친쪽, 안보이는블록, 쪽수: document.querySelectorAll('[data-jan-page]').length }
  })
}

test('단락 간격을 넓히면 쪽을 다시 짠다 — 글이 종이 밖에서 사라지지 않는다', async ({ page }) => {
  test.setTimeout(90000)
  await 열기(page)

  const 전 = await 종이밖(page)
  // 시험의 전제가 참인가 — 여러 쪽짜리 문서가 처음에는 멀쩡하다
  expect(전.쪽수).toBeGreaterThan(3)
  expect(전.넘침, '고르기 전부터 넘쳐 있으면 이 시험은 아무것도 재지 못한다').toBeLessThan(4)

  await 리본에서고르기(page, '단락 간격', '두 줄 간격')
  await page.waitForTimeout(3500)

  const 넓힌뒤 = await 종이밖(page)
  // 줄이 넓어졌으니 쪽은 늘어야 한다 (그대로면 늘어난 글이 어딘가에서 잘린 것이다)
  expect(넓힌뒤.쪽수, '줄 간격을 넓혔는데 쪽 수가 그대로다 — 다시 짜지 않았다').toBeGreaterThan(전.쪽수)
  expect(넓힌뒤.안보이는블록, '종이 밖으로 빠져 보이지 않는 블록이 있다').toBe(0)
  expect(넓힌뒤.넘침, '아래 여백을 뚫은 채로 남았다').toBeLessThan(4)

  // 되돌리는 쪽도 같다 — 좁히면 쪽이 도로 줄어야 한다
  await 리본에서고르기(page, '단락 간격', '좁게')
  await page.waitForTimeout(3500)
  const 좁힌뒤 = await 종이밖(page)
  expect(좁힌뒤.쪽수, '줄 간격을 좁혔는데 쪽 수가 그대로다').toBeLessThan(넓힌뒤.쪽수)
  expect(좁힌뒤.안보이는블록).toBe(0)
  expect(좁힌뒤.넘침).toBeLessThan(4)
})

/**
 * 반대쪽 울타리 — 길이에 아무 상관 없는 스타일(색)까지 다시 짜면 쪽이 공연히 들썩인다.
 * 위 시험만 있으면 「무엇이든 바뀌면 다시 짜기」 로 통과할 수 있어서, 그것을 막는다.
 */
test('색만 바꾸면 쪽 나눔은 꿈쩍하지 않는다', async ({ page }) => {
  test.setTimeout(90000)
  await 열기(page)
  const 전 = await 종이밖(page)
  expect(전.넘침).toBeLessThan(4)

  await 리본에서고르기(page, '테마 색', '와인')
  await page.waitForTimeout(2500)

  const 후 = await 종이밖(page)
  expect(후.쪽수, '색을 바꿨을 뿐인데 쪽 수가 달라졌다').toBe(전.쪽수)
  expect(후.넘침).toBeLessThan(4)
  expect(후.안보이는블록).toBe(0)
})
