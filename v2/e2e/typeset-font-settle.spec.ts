import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

/**
 * 웹 글꼴이 늦게 안착하면 쪽을 다시 짜는가.
 *
 * 글꼴 파일이 아직 안 왔으면 브라우저는 **대체 글꼴**로 높이를 잰다. 파일이 닿는 순간
 * 글자 폭과 줄 높이가 함께 바뀌어 온 문서의 문단 높이가 일제히 출렁이는데, 이때
 * **DOM 은 한 글자도 바뀌지 않는다.** 「문서가 바뀔 때」 만 도는 쪽 나눔도, 전역 스타일을
 * 지켜보는 MutationObserver 도 이것을 못 본다. 쪽은 overflow:clip 이라 늘어난 글은
 * 다음 쪽으로 가지도, 지워지지도 않고 **그냥 보이지 않게 된다** — 줄 간격을 바꿔도
 * 조판이 안 돌던 것과 같은 갈래다.
 *
 * 실측(고치기 전, 라틴 90문단·글꼴을 4초 늦춤):
 *   대체 글꼴로 여섯 쪽에 앉았다(문단 48px). 글꼴이 닿자 문단이 71px 이 되어
 *   쪽 다섯이 아래 여백을 371px 뚫고 블록 15개가 종이 밖으로 사라졌다.
 *   그 뒤 4초를 기다려도 조판 트랜잭션은 0 회. 쪽 수는 여섯 그대로(옳은 값은 여덟).
 * 고친 뒤: 여덟 쪽 · 넘침 0 · 안 보이는 블록 0 · 조판 트랜잭션 7 회.
 *
 * 글꼴 파일은 저장소에 담지 않는다(글꼴은 저작물이다) — 이 컴퓨터에 깔린 것을 하나 빌려
 * 「웹 글꼴」 인 척 늦게 흘려 보낸다. 어느 글꼴이 걸리든 상관없도록 size-adjust 로 크기를
 * 억지로 벌려 두었다 — 재는 것은 「글꼴이 무엇인가」 가 아니라 「높이가 바뀌었는가」 다.
 */

const 빌릴글꼴 = [
  'C:/Windows/Fonts/ariblk.ttf',
  'C:/Windows/Fonts/arial.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
].find((p) => existsSync(p))

type Page = import('@playwright/test').Page

const 채움 = (i: number) =>
  `<p>Paragraph number ${i} exists only to fill the page with enough words that it wraps to several lines. Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore.</p>`
const 본문 = Array.from({ length: 90 }, (_, i) => 채움(i + 1)).join('')

/** 쪽마다 「아래 여백을 뚫었는가」 와 「종이 밖으로 빠져 보이지 않는 블록이 있는가」 */
async function 종이밖(page: Page) {
  return page.evaluate(() => {
    let 넘침 = 0
    let 안보이는블록 = 0
    document.querySelectorAll('[data-jan-page]').forEach((pg) => {
      const el0 = pg as HTMLElement
      if (el0.getAttribute('data-jan-grow') === '1') return
      const r0 = el0.getBoundingClientRect()
      const 아래 = r0.bottom - (parseFloat(getComputedStyle(el0).paddingBottom) || 0)
      Array.from(el0.children).forEach((c) => {
        const el = c as HTMLElement
        if (el.classList.contains('ProseMirror-widget')) return
        if (getComputedStyle(el).position === 'absolute') return
        const r = el.getBoundingClientRect()
        if (!r.height) return
        if (r.top >= r0.bottom) 안보이는블록 += 1
        if (r.bottom > 아래) 넘침 = Math.max(넘침, r.bottom - 아래)
      })
    })
    const 첫 = document.querySelector('.ProseMirror p') as HTMLElement | null
    return {
      넘침: Math.round(넘침),
      안보이는블록,
      쪽수: document.querySelectorAll('[data-jan-page]').length,
      첫문단높이: 첫 ? Math.round(첫.getBoundingClientRect().height) : 0,
      글꼴왔나: document.fonts.check('16px JanProbeWeb'),
    }
  })
}

/** 글꼴을 늦춰 흘려 보내며 문서를 연다 (늦춤 0 이면 곧바로 준다) */
async function 열기(page: Page, 늦춤: number) {
  await page.route('**/janprobe-font.ttf', async (route) => {
    if (늦춤) await new Promise((r) => setTimeout(r, 늦춤))
    await route.fulfill({ status: 200, contentType: 'font/ttf', body: readFileSync(빌릴글꼴!) })
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(400)
  /* 앱이 웹 글꼴을 싣는 것과 같은 꼴 — <head> 에 @font-face 한 장.
     이 붙이기 자체는 글꼴을 받아오지 않는다(그 글꼴로 그릴 글이 아직 없다). */
  await page.evaluate(() => {
    const s = document.createElement('style')
    s.textContent =
      "@font-face{font-family:'JanProbeWeb';src:url('/janprobe-font.ttf') format('truetype');size-adjust:145%;font-display:swap}" +
      ".ProseMirror, .ProseMirror *{font-family:'JanProbeWeb', Arial, sans-serif !important}"
    document.head.appendChild(s)
  })
  await page.waitForTimeout(200)
  await page.evaluate((h) => {
    const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }
    w.__janEditor.commands.setContent(h)
  }, 본문)
}

test.skip(!빌릴글꼴, '빌릴 글꼴 파일이 이 컴퓨터에 없다')

test('늦게 온 웹 글꼴이 안착하면 쪽을 다시 짠다 — 글이 종이 밖에서 사라지지 않는다', async ({ page }) => {
  test.setTimeout(120000)

  // ① 견줌 — 글꼴이 처음부터 있을 때의 옳은 답
  await 열기(page, 0)
  await page.waitForTimeout(6000)
  const 견줌 = await 종이밖(page)
  expect(견줌.글꼴왔나, '견줌에서 글꼴이 안 왔다 — 이 시험은 아무것도 재지 못한다').toBe(true)
  expect(견줌.쪽수).toBeGreaterThan(3)
  expect(견줌.넘침).toBeLessThan(4)

  // ② 같은 글을 글꼴을 4초 늦춰 싣는다
  await page.context().clearCookies()
  await 열기(page, 4000)
  await page.waitForTimeout(3000)
  const 오기전 = await 종이밖(page)
  // 시험의 전제 — 대체 글꼴로 이미 다 짜였고, 그 높이가 진짜 글꼴과 다르다
  expect(오기전.글꼴왔나, '글꼴이 벌써 왔다 — 늦추기가 듣지 않았다').toBe(false)
  expect(오기전.넘침, '글꼴이 오기도 전에 넘쳐 있으면 뒤의 값이 무엇을 뜻하는지 알 수 없다').toBeLessThan(4)
  expect(오기전.첫문단높이).toBeLessThan(견줌.첫문단높이)

  await page.waitForFunction(() => document.fonts.check('16px JanProbeWeb'), undefined, { timeout: 20000 })
  await page.waitForTimeout(4000)

  const 온뒤 = await 종이밖(page)
  expect(온뒤.첫문단높이, '글꼴이 왔는데 높이가 그대로다 — 잴 것이 없다').toBe(견줌.첫문단높이)
  expect(온뒤.안보이는블록, '글꼴이 안착한 뒤 종이 밖으로 빠져 보이지 않는 블록이 있다').toBe(0)
  expect(온뒤.넘침, '글꼴이 안착한 뒤에도 아래 여백을 뚫은 채로 남았다').toBeLessThan(4)
  expect(온뒤.쪽수, '글꼴이 안착했는데 쪽 수가 처음부터 있었을 때와 다르다 — 다시 짜지 않았다').toBe(견줌.쪽수)
})

/**
 * 반대쪽 울타리 — 실린 글꼴이 그대로면 조판은 꿈쩍하지 않는다.
 *
 * 위 시험만 있으면 「글꼴 쪽에서 소식이 오면 무조건 다시 짜기」 로도 통과한다.
 * 그러면 이 앱처럼 웹 글꼴을 하나도 안 싣는 문서에서도 `document.fonts.ready` 가 풀릴
 * 때마다, 그리고 남이 글꼴을 하나 두드릴 때마다 온 문서를 공연히 다시 재게 된다.
 *
 * 다시 짜는 일이 실제로 걸렸는지는 트랜잭션으로는 안 보인다 — 이미 다 짜인 문서를 다시
 * 훑으면 고칠 것이 없어 트랜잭션이 0 이기 때문이다(재 보니 있으나 없으나 0 이었다).
 * 그래서 **한 판을 걸었는가**, 곧 requestAnimationFrame 이 잡혔는가를 잰다.
 * 다 짜여 조용한 편집기에서 이 값은 정확히 0 이다.
 * (울타리를 빼고 재면 가라 loadingdone 뒤 rAF 가 1 로 는다 — 이 시험이 그것을 잡는다.)
 */
test('실린 글꼴이 그대로면 조판은 꿈쩍하지 않는다', async ({ page }) => {
  test.setTimeout(90000)
  await 열기(page, 0)
  await page.waitForTimeout(6000)

  await page.evaluate(() => {
    const w = window as unknown as { __raf: number }
    w.__raf = 0
    const orig = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => { w.__raf += 1; return orig(cb) }
  })
  // 전제 — 다 짜인 편집기는 아무 프레임도 잡지 않는다
  await page.waitForTimeout(1500)
  const 조용 = await page.evaluate(() => {
    const w = window as unknown as { __raf: number }
    const v = w.__raf
    w.__raf = 0
    return v
  })
  expect(조용, '가만히 두어도 프레임을 잡고 있다 — 이 시험은 아무것도 재지 못한다').toBe(0)

  // 새로 실린 글꼴은 하나도 없는데 소식만 온다 (남이 글꼴을 두드릴 때 실제로 이렇다)
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) document.fonts.dispatchEvent(new Event('loadingdone'))
  })
  await page.waitForTimeout(1500)
  const 때린뒤 = await page.evaluate(() => (window as unknown as { __raf: number }).__raf)
  expect(때린뒤, '실린 글꼴이 그대로인데 조판을 다시 걸었다').toBe(0)
})
