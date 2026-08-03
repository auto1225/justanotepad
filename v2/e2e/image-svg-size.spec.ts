import { test, expect } from '@playwright/test'

/**
 * SVG 는 그림이 스스로 밝힌 치수(viewBox)대로 놓여야 한다.
 *
 * width·height 없이 viewBox 만 있는 SVG 에는 물리 치수가 없다. 그러면 브라우저는
 * 「기본 개체 크기」 300×150 안에 비율을 맞춰 넣은 값을 naturalWidth 로 준다 —
 * 그림이 스스로 밝힌 치수와는 아무 상관이 없는 숫자다. 그 값으로 예약 상자를 걸면
 * 똑같은 그림이 치수를 적었느냐 안 적었느냐에 따라 두 배 넘게 다르게 놓이고,
 * 비율이 극단이면 naturalWidth 가 0 이 되어 예약 상자를 아예 못 걸고
 * 그림 하나가 문서를 통째로 찢는다 (재어 보니 641×640,531px, 문서 높이 640,684px).
 *
 * 화면에 걸리는 것을 보아야 하므로 마크가 붙었는지가 아니라
 * getBoundingClientRect() 로 잰다.
 */

const FRAME = (inner: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${inner}>${body}</svg>`

/* 같은 그림 한 쌍 — 하나는 치수를 적었고 하나는 viewBox 만 있다 */
const PAINT = '<rect x="0" y="0" width="800" height="200" fill="#2a7"/>'
const WITH_SIZE = FRAME('width="800" height="200" viewBox="0 0 800 200"', PAINT)
const VIEWBOX_ONLY = FRAME('viewBox="0 0 800 200"', PAINT)
/* 비율이 극단이라 브라우저의 기본 치수가 0×150 이 되는 그림 */
const DEGENERATE = FRAME('viewBox="0 0 1 1000"', '<rect width="1" height="1000" fill="#27a"/>')

async function boot(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  /* 앞서 넣은 것이 저장소에 남아 다시 열린다 — 비우고 시작해야 「지금 넣은 그림」 을 잰다.
     (이것을 빼면 한 시험 안에서 두 번 재는 자리가 늘 같은 그림을 재어 그냥 통과한다) */
  await page.evaluate(() => {
    const w = window as unknown as { __janEditor?: { commands: { clearContent: (b: boolean) => void } } }
    w.__janEditor?.commands.clearContent(true)
  })
  await expect(page.locator('.ProseMirror img.jan-img-el')).toHaveCount(0)
  await page.waitForTimeout(200)
  return doc
}

/** 탐색기에서 .svg 파일을 끌어다 놓는 길 그대로 (앱이 저장소 주소로 바꿔 넣는다) */
async function dropSvg(page: import('@playwright/test').Page, markup: string) {
  await page.evaluate((src) => {
    const dt = new DataTransfer()
    dt.items.add(new File([src], 'diagram.svg', { type: 'image/svg+xml' }))
    const dom = document.querySelector('.ProseMirror') as HTMLElement
    const r = dom.getBoundingClientRect()
    dom.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: r.left + 40, clientY: r.top + 40,
    }))
  }, markup)
  await page.locator('.ProseMirror img.jan-img-el').first().waitFor({ state: 'attached' })
  await page.waitForTimeout(900)
}

/** 화면에 실제로 걸린 크기 */
async function shown(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img.jan-img-el') as HTMLImageElement | null
    if (!img) return null
    const r = img.getBoundingClientRect()
    const doc = document.querySelector('.ProseMirror') as HTMLElement
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      docH: Math.round(doc.getBoundingClientRect().height),
    }
  })
}

test('viewBox 만 있는 SVG 가 치수를 적어 둔 같은 그림과 똑같이 놓인다', async ({ page }) => {
  await boot(page)
  await dropSvg(page, WITH_SIZE)
  const 적어둔것 = await shown(page)

  await boot(page)
  await dropSvg(page, VIEWBOX_ONLY)
  const viewBox만 = await shown(page)

  expect(적어둔것).not.toBeNull()
  expect(viewBox만).not.toBeNull()
  /* 예전에는 641×160 과 300×75 로 갈렸다 — 두 배가 넘게 */
  expect(viewBox만!.w).toBeGreaterThan(적어둔것!.w - 2)
  expect(viewBox만!.w).toBeLessThan(적어둔것!.w + 2)
  expect(viewBox만!.h).toBeGreaterThan(적어둔것!.h - 2)
  expect(viewBox만!.h).toBeLessThan(적어둔것!.h + 2)
  /* 4:1 그림이니 본문 폭에 맞춰 눕는다 — 300px 짜리 조각이 아니다 */
  expect(viewBox만!.w).toBeGreaterThan(400)
})

test('비율이 극단인 viewBox 만의 SVG 가 지면을 찢지 않는다', async ({ page }) => {
  await boot(page)
  await dropSvg(page, DEGENERATE)
  const now = await shown(page)
  expect(now).not.toBeNull()
  /* 예전에는 641×640,531px 로 부풀어 문서 높이가 1,123 → 640,684px 이 되었다 */
  expect(now!.h).toBeLessThan(2000)
  expect(now!.docH).toBeLessThan(5000)
})

test('세로로 긴 viewBox 만의 SVG 가 조각으로 쪼그라들지 않는다', async ({ page }) => {
  await boot(page)
  await dropSvg(page, FRAME('viewBox="0 0 200 800"', '<rect width="200" height="800" fill="#a72"/>'))
  const now = await shown(page)
  expect(now).not.toBeNull()
  /* 예전에는 38×150 — 200×800 짜리 세로 그림이 폭 38px 조각이 되었다 */
  expect(now!.w).toBeGreaterThan(150)
  expect(now!.h).toBeGreaterThan(600)
  expect(Math.abs(now!.w / now!.h - 200 / 800)).toBeLessThan(0.02)
})
