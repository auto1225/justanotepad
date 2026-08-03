import { test, expect, type Page } from '@playwright/test'

/**
 * 숨은 행이 있는 표를 쪽 경계에서 나눌 때.
 *
 * 숨은 행(display:none)은 상자가 **아예 없어** getBoundingClientRect() 가 0,0,0,0 이다.
 * rowsThatFit 은 「행 바닥 − 표 꼭대기」 로 재므로, 화면을 내려 표 꼭대기가 음수가 되면
 * 그 0 이 「표 꼭대기에서 2,623px 아래」 로 읽혀 숨은 행 하나가 지면을 넘긴 것처럼 보였다.
 *
 * 실측(40행 표·5~14행 숨김·A4·본문 1280×720·2,923px 내려본 화면):
 *   고치기 전  앞 조각 4행(140px), 쪽 3 → 4     ← 숨김 없을 때는 15행(523px), 쪽 3
 *   고친 뒤    앞 조각 25행(523px), 쪽 3        ← 숨김 없을 때와 그려진 높이가 같다
 * 화면을 어디까지 내렸느냐가 조판을 바꾸고 있었다.
 *
 * 앱에는 아직 행 숨김 기능이 없어, 스키마에 있는 행 속성(data-height)에 서식을 물려
 * 숨긴다 — 변경 이력·필터·숨김 서식 어느 길로 숨더라도 조판이 보는 것은 같다.
 */

async function 문서를(page: Page, html: string) {
  await page.evaluate((h) => {
    const ed = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }).__janEditor
    ed.commands.setContent(h)
  }, html)
}

async function 조판끝(page: Page) {
  const snapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')]
        .map((p) => `${p.children.length}:${Math.round((p as HTMLElement).getBoundingClientRect().height)}`)
        .join(','))
  let prev = ''
  let stable = 0
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(120)
    const now = await snapshot()
    stable = now === prev && now !== '' ? stable + 1 : 0
    prev = now
    if (stable >= 3) return true
  }
  return false
}

/** 바깥 표 조각마다 — 행 수 · 숨은 행 수 · 그려진 높이 · 놓인 쪽 */
async function 조각(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.ProseMirror') as HTMLElement
    const own = (t: Element) => [...t.querySelectorAll('tr')]
      .filter((r) => r.closest('table') === t && !r.hasAttribute('data-repeated'))
    const pages = [...document.querySelectorAll('.jan-page-node')]
    return [...root.querySelectorAll('table')]
      .filter((t) => !t.parentElement?.closest('table'))
      .map((t) => {
        const rows = own(t)
        return {
          행: rows.length,
          보이는행: rows.filter((r) => r.getClientRects().length > 0).length,
          높이: Math.round(t.getBoundingClientRect().height),
          쪽: pages.findIndex((p) => p.contains(t)),
        }
      })
  })
}

const 쪽수 = (page: Page) => page.evaluate(() => document.querySelectorAll('.jan-page-node').length)

const 표 = (n: number, hide: number[]) =>
  '<table><tbody>' +
  Array.from({ length: n }, (_, i) =>
    `<tr${hide.includes(i + 1) ? ' data-height="0px"' : ''}><td><p>행${i + 1}</p></td><td><p>값${i + 1}</p></td></tr>`).join('') +
  '</tbody></table>'

const 사이 = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/** 쪽들을 담은 상자를 바닥까지 내린다 — 앞 쪽의 표가 화면 위로 밀려 올라간다 */
async function 바닥으로(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('.jan-editor-main') as HTMLElement
    box.scrollTop = box.scrollHeight
    return Math.round(box.scrollTop)
  })
}

/** 커서를 옮기지 않고 문서 맨 앞에 글을 밀어 넣는다 (스크롤이 따라가지 않게) */
async function 앞에밀어넣기(page: Page, 글: string) {
  await page.evaluate((t) => {
    const ed = (window as unknown as { __janEditor: { state: { tr: { insertText: (t: string, p: number) => unknown } }; view: { dispatch: (tr: unknown) => void } } }).__janEditor
    const tr = ed.state.tr.insertText(t, 2) as { setMeta: (k: string, v: unknown) => void }
    tr.setMeta('addToHistory', false)
    ed.view.dispatch(tr)
  }, 글)
}

/** 화면을 내려 둔 채로 표를 다시 나누게 하고, 앞 조각이 그려진 높이를 잰다 */
async function 내려본채나누기(page: Page, hide: number[]) {
  const 뒤 = Array.from({ length: 6 }, (_, i) => `<p>${'뒤 글. '.repeat(120)} ${i}</p>`).join('')
  await 문서를(page, '<p>앞</p>' + 표(40, hide) + 뒤)
  expect(await 조판끝(page)).toBe(true)
  expect(await 바닥으로(page)).toBeGreaterThan(1000)   // 정말 내려갔는가
  await page.waitForTimeout(200)
  const top = await page.evaluate(() =>
    Math.round((document.querySelector('.ProseMirror table') as HTMLElement).getBoundingClientRect().top))
  expect(top).toBeLessThan(0)                          // 표 꼭대기가 화면 위로 올라갔는가
  await 앞에밀어넣기(page, '앞 글을 채운다. '.repeat(120))
  expect(await 조판끝(page)).toBe(true)
  return { 조각: await 조각(page), 쪽수: await 쪽수(page) }
}

test.describe('숨은 행이 있는 표의 쪽 나눔', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    const model = await page.evaluate(
      () => document.querySelector('[data-page-model]')?.getAttribute('data-page-model') ?? '')
    test.skip(model !== 'nodes', `독립 페이지 모델이 아님 (${model})`)
    await page.getByRole('button', { name: '새 메모', exact: true }).first().click()
    await page.addStyleTag({ content: `.ProseMirror tr[data-height="0px"]{display:none;}` })
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
  })

  test('화면을 내려 둔 채 나누어도 숨은 행이 나눌 자리를 앞당기지 않는다', async ({ page }) => {
    const 숨김없음 = await 내려본채나누기(page, [])
    const 숨김 = await 내려본채나누기(page, 사이(5, 14))

    // 숨은 행은 자리를 안 먹는다 — 앞 조각이 그려진 높이가 같아야 한다
    expect(숨김.조각[0].높이).toBe(숨김없음.조각[0].높이)
    // 보이는 행 수도 같다 (숨은 열 개는 그저 함께 따라온다)
    expect(숨김.조각[0].보이는행).toBe(숨김없음.조각[0].보이는행)
    // 숨김 때문에 쪽이 늘어나지 않는다 (고치기 전에는 3 → 4 였다)
    expect(숨김.쪽수).toBe(숨김없음.쪽수)
  })
})
