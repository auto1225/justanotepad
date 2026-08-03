import { test, expect } from '@playwright/test'

/**
 * 못 물린 그림도 자리를 지켜야 한다 — 워드의 「그림을 표시할 수 없습니다」.
 *
 * 주소가 깨졌거나 아예 비면 브라우저는 알맹이를 0×0 으로 잡는다. 그러면 상자가 통째로
 * 쪼그라들어 — 재어 보니 빈 주소는 **640×0px**, 깨진 http 는 **640×16px** 이었다 —
 * 사람이 그 그림을 다시 클릭해 고를 수도, 지울 수도, 주소를 고칠 수도 없다.
 * 문서 안에 있는데 손이 닿지 않는 것이다.
 *
 * 재는 자리를 조심해야 한다. 「data 속성이 붙었다」 만 보면 CSS 에 눌려 화면에는 아무것도
 * 안 나오는 것을 못 잡는다. 그래서 여기서는 getBoundingClientRect·getComputedStyle 로
 * **화면에 실제로 잡힌 치수**를 재고, 진짜 마우스로 눌러 골라지는지 본다.
 */

type W = {
  __janEditor: {
    commands: { setContent: (h: string) => void }
    chain: () => { focus: () => { setNodeSelection: (p: number) => { run: () => void } } }
    state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }
    on: (e: string, f: (p: unknown) => void) => void
    off: (e: string, f: (p: unknown) => void) => void
  }
}

/** 있지도 않은 곳 — 연결이 곧바로 거절되어 error 가 난다 */
const 죽은주소 = 'https://localhost:1/none.png'

async function 준비(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  return doc
}

async function 넣기(page: import('@playwright/test').Page, html: string) {
  await page.evaluate((h) => {
    ;(window as unknown as W).__janEditor.commands.setContent(h)
  }, html)
}

const 그림수 = (page: import('@playwright/test').Page) => page.evaluate(() => {
  let n = 0
  ;(window as unknown as W).__janEditor.state.doc.descendants((nd) => { if (nd.type.name === 'image') n += 1 })
  return n
})

for (const [이름, src] of [['주소가 깨진 그림', 죽은주소], ['주소가 빈 그림', '']] as const) {
  test(`${이름} 도 자리를 남겨 클릭·삭제할 수 있다`, async ({ page }) => {
    const doc = await 준비(page)
    await 넣기(page, `<p>앞 글</p><img src="${src}"><p>뒤 글</p>`)
    await expect(doc.locator('img')).toHaveCount(1)
    await page.waitForTimeout(1800)

    /* ⓐ 화면에 잡힌 치수가 최소 치수를 지키는가 — 마크가 아니라 실제 상자를 잰다 */
    const 잰값 = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror img') as HTMLImageElement
      const r = el.getBoundingClientRect()
      return { w: r.width, h: r.height, 표시: el.getAttribute('data-jan-broken'), 테두리: getComputedStyle(el).borderTopStyle }
    })
    expect(잰값.표시).toBe('1')
    expect(잰값.h).toBeGreaterThanOrEqual(48) // 쪼그라들면 0~16px 이 된다
    expect(잰값.w).toBeGreaterThanOrEqual(48)
    expect(잰값.테두리).toBe('dashed') // 「여기 그림이 있다」 는 가상 테두리

    /* ⓑ 진짜 마우스로 눌러 골라지는가 */
    const box = await doc.locator('img').first().boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1)

    /* ⓒ Delete 로 지워지는가 */
    await page.keyboard.press('Delete')
    await page.waitForTimeout(500)
    expect(await 그림수(page)).toBe(0)
    await expect(doc.locator('img')).toHaveCount(0)
  })
}

test('원래 크기를 아는 그림은 주소가 깨져도 그 크기대로 자리를 지킨다', async ({ page }) => {
  const doc = await 준비(page)
  /* 저장본에서 온 그림은 원래 크기를 data-nw·nh 로 함께 지고 온다.
     예전에는 이 자리 예약이 저장소 주소(jan-blob://)일 때만 걸려서, 밖에서 온 http 그림이
     깨지면 640×16 으로 쪼그라들었다 — 그 수축이 앞 쪽의 평형을 깬다. */
  await 넣기(page, `<p>앞</p><img src="${죽은주소}" data-nw="320" data-nh="240"><p>뒤</p>`)
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(1800)
  const r = await page.evaluate(() => {
    const el = document.querySelector('.ProseMirror img') as HTMLImageElement
    const b = el.getBoundingClientRect()
    return { w: Math.round(b.width), h: Math.round(b.height) }
  })
  expect(r.w).toBe(320)
  expect(r.h).toBe(240)
})

test('깨진 그림이 있어도 쪽 나눔이 맴돌지 않는다', async ({ page }) => {
  const doc = await 준비(page)
  const 문단 = Array.from({ length: 40 }, (_, i) => `<p>문단 ${i + 1} — 여러 쪽을 만드는 글이다. 조금 길게 쓴다.</p>`).join('')
  await 넣기(page, `<p>앞</p><img src="${죽은주소}">${문단}`)
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(3000)
  const 변경 = await page.evaluate(async () => {
    const e = (window as unknown as W).__janEditor
    let n = 0
    const on = (p: unknown) => { if ((p as { transaction: { docChanged: boolean } }).transaction.docChanged) n += 1 }
    e.on('transaction', on)
    await new Promise((r) => setTimeout(r, 2500))
    e.off('transaction', on)
    return { n, 쪽: document.querySelectorAll('[data-jan-page]').length }
  })
  expect(변경.n).toBeLessThan(5) // 맴돌면 수백 번이 된다
  expect(변경.쪽).toBeGreaterThan(1)
})
