import { test, expect } from '@playwright/test'

/**
 * 그림을 놓는 자리가 「글이 없는 곳」이어도 탈이 나면 안 된다.
 *
 * 놓기를 가로채기 단계(capture)에서 처리하면서 두 구멍이 생겼다.
 *
 * 하나. 붙일 자리를 못 찾으면(posAtCoords 가 null) 그냥 빠져나갔다. preventDefault 를
 *       안 하므로 브라우저와 ProseMirror 의 기본 놓기가 그대로 돈다 — 그 길은 집어 든
 *       자리를 기억했다가 놓을 때 거기를 지우는데, 끄는 사이 쪽이 다시 짜여 그림이
 *       옮겨지면 못 지우고 넣기만 해 「그림이 둘이 된다」.
 *
 * 둘.  가로채기 단계에서 stopImmediatePropagation 을 하면 ProseMirror 의 drop 처리기가
 *       돌지 않는다. 그쪽이 finally 로 하던 `view.dragging = null` 뒷정리가 빠진다.
 *       놓은 그림은 새 요소로 다시 그려져 원래 요소가 문서에서 떨어져 나가므로,
 *       브라우저가 그 떨어진 요소에 보내는 dragend 도 편집기까지 올라오지 못한다.
 *       그러면 view.dragging 이 영영 남고 — 조판 엔진이 「아직 끌고 있다」 로 보고
 *       쪽 나눔을 통째로 멈춘다. 재어 보니 드롭 뒤에는 70 문단을 넣어도 쪽이 1 이었다.
 */

type W = {
  __janEditor: {
    commands: { setContent: (h: string) => void }
    state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }
    view: { dom: HTMLElement; dragging?: unknown; posAtCoords: (c: { left: number; top: number }) => unknown }
  }
}

async function 준비(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await page.evaluate(() => {
    const e = (window as unknown as W).__janEditor
    const c = document.createElement('canvas')
    c.width = 200; c.height = 140
    const x = c.getContext('2d')!
    x.fillStyle = '#4488cc'; x.fillRect(0, 0, 200, 140)
    e.commands.setContent(`<p>첫 줄</p><img src="${c.toDataURL('image/png')}"><p>둘째 줄</p><p>셋째 줄 — 여기로 옮긴다</p>`)
  })
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(1200)
  return doc
}

const 그림수 = (page: import('@playwright/test').Page) => page.evaluate(() => {
  let n = 0
  ;(window as unknown as W).__janEditor.state.doc.descendants((nd) => { if (nd.type.name === 'image') n += 1 })
  return n
})

test('붙일 자리를 못 찾아도 그림이 둘이 되지 않고 기본 놓기가 막힌다', async ({ page }) => {
  const doc = await 준비(page)
  const r = await page.evaluate(async () => {
    const w = (ms: number) => new Promise((z) => setTimeout(z, ms))
    const view = (window as unknown as W).__janEditor.view as unknown as { posAtCoords: (c: unknown) => unknown }
    const img = document.querySelector('.ProseMirror img') as HTMLElement
    const dt = new DataTransfer()
    const ir = img.getBoundingClientRect()
    img.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: ir.x + 5, clientY: ir.y + 5 }))
    await w(150)
    /* 글이 없는 자리(쪽 사이 빈틈·쪽 옆 그림자 자리)에서 posAtCoords 가 주는 답을 그대로 만든다 */
    const 원래 = view.posAtCoords
    view.posAtCoords = () => null
    const ps = [...document.querySelectorAll('.ProseMirror p')]
    const last = ps[ps.length - 1]
    const lr = last.getBoundingClientRect()
    const ev = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: lr.x + 20, clientY: lr.y + lr.height / 2 })
    last.dispatchEvent(ev)
    await w(600)
    view.posAtCoords = 원래
    return { 기본막힘: ev.defaultPrevented }
  })
  /* 기본 놓기가 돌지 않아야 한다 — 그것이 그림을 둘로 만드는 길이다 */
  expect(r.기본막힘).toBe(true)
  expect(await 그림수(page)).toBe(1)
  await expect(doc.locator('img')).toHaveCount(1)
})

test('그림을 놓은 뒤에도 쪽 나눔이 계속 돈다', async ({ page }) => {
  const doc = await 준비(page)

  /* 브라우저가 하는 그대로 — 집어 들고, 놓고, 원래 요소에 dragend 를 보낸다.
     놓는 사이 그림이 새 요소로 다시 그려지면 원래 요소는 문서에서 떨어져 나가므로
     그 dragend 는 편집기 뿌리까지 올라오지 못한다. */
  const 드롭 = await page.evaluate(async () => {
    const w = (ms: number) => new Promise((z) => setTimeout(z, ms))
    const view = (window as unknown as W).__janEditor.view
    const img = document.querySelector('.ProseMirror img') as HTMLElement
    const dt = new DataTransfer()
    const ir = img.getBoundingClientRect()
    img.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: ir.x + 5, clientY: ir.y + 5 }))
    await w(150)
    const ps = [...document.querySelectorAll('.ProseMirror p')]
    const last = ps[ps.length - 1]
    const lr = last.getBoundingClientRect()
    last.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: lr.x + 20, clientY: lr.y + lr.height / 2 }))
    await w(200)
    const 떨어졌나 = !document.contains(img)
    img.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true, cancelable: true }))
    await w(500)
    return { 떨어졌나, dragging남음: !!view.dragging }
  })
  expect(드롭.떨어졌나).toBe(true)      // 다시 그려져 원래 요소가 떨어져 나간다
  expect(드롭.dragging남음).toBe(false) // 그래도 끌기 표시는 풀려 있어야 한다
  expect(await 그림수(page)).toBe(1)

  /* 이제 여러 쪽이 될 만큼 글을 넣는다 — 조판이 멎어 있으면 한 쪽에 다 밀어 넣는다 */
  await page.evaluate(() => {
    const 문단 = Array.from({ length: 70 }, (_, i) => `<p>덧붙임 ${i + 1} — 여러 쪽이 되도록 넉넉히 채우는 글이다. 길게.</p>`).join('')
    ;(window as unknown as W).__janEditor.commands.setContent(`<p>앞</p>${문단}`)
  })
  await page.waitForTimeout(4000)
  const 쪽 = await page.evaluate(() => document.querySelectorAll('[data-jan-page]').length)
  expect(쪽).toBeGreaterThan(1)
  await expect(doc.locator('[data-jan-page]')).not.toHaveCount(1)
})
