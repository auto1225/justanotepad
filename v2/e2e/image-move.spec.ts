import { test, expect } from '@playwright/test'

/**
 * 그림을 끌어 옮겨도 복사되지 않아야 한다.
 *
 * 사용자의 저장본에서 한 그림이 아홉 장까지 불어나 있었다 (겹친 주소 eef7e147×9).
 * 여백에 닿을 때 · 표 선에 닿을 때 · 쪽을 넘길 때 — 모두 쪽이 다시 짜이는 순간이다.
 * 브라우저의 끌어놓기는 집어 든 자리를 기억했다가 놓을 때 거기를 지우는데, 그 사이
 * 쪽이 다시 짜여 그림이 옮겨지면 원래 자리를 못 찾아 지우지 못하고 넣기만 한다.
 *
 * 그래서 옮기는 일을 우리가 한다. 다만 「어디서」 가 중요했다 —
 * 편집기 안에서 drop 을 듣는 플러그인이 아홉이고 우리 것은 일흔두 번째라,
 * props.handleDOMEvents 에 두었더니 앞선 것이 먼저 처리해 우리 차례가 오지 않았다.
 * 가로채기 단계(capture)는 거품이 올라오기 전이라 차례를 다툴 일이 없다.
 */

async function 준비(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }).__janEditor
    const c = document.createElement('canvas')
    c.width = 200; c.height = 140
    const x = c.getContext('2d')!
    const im = x.createImageData(200, 140)
    for (let i = 0; i < im.data.length; i += 4) {
      im.data[i] = (i * 7) % 255; im.data[i + 1] = (i * 13) % 255; im.data[i + 2] = (i * 29) % 255; im.data[i + 3] = 255
    }
    x.putImageData(im, 0, 0)
    e.commands.setContent(`<p>첫 줄</p><img src="${c.toDataURL('image/png')}"><p>둘째 줄</p><p>셋째 줄 — 여기로 옮긴다</p>`)
  })
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(1200)
  return doc
}

/** 그림을 집어 마지막 문단에 놓는다 — 브라우저의 끌어놓기와 같은 차례로 */
async function 끌어놓기(page: import('@playwright/test').Page, opts: { ctrl?: boolean } = {}) {
  return page.evaluate(async (ctrl: boolean) => {
    const w = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const img = document.querySelector('.ProseMirror img') as HTMLElement
    const dt = new DataTransfer()
    const ir = img.getBoundingClientRect()
    img.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: ir.x + 5, clientY: ir.y + 5 }))
    await w(150)
    const ps = [...document.querySelectorAll('.ProseMirror p')]
    const last = ps[ps.length - 1]
    const lr = last.getBoundingClientRect()
    last.dispatchEvent(new DragEvent('drop', {
      dataTransfer: dt, bubbles: true, cancelable: true,
      clientX: lr.x + 20, clientY: lr.y + lr.height / 2, ctrlKey: ctrl,
    }))
    await w(900)
  }, !!opts.ctrl)
}

const 그림수 = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const e = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string } }) => void) => void } } } }).__janEditor
  let n = 0
  e.state.doc.descendants((nd) => { if (nd.type.name === 'image') n += 1 })
  return n
})

test('끌어 옮기면 옮겨질 뿐 복사되지 않는다', async ({ page }) => {
  const doc = await 준비(page)
  expect(await 그림수(page)).toBe(1)
  await 끌어놓기(page)
  await page.waitForTimeout(600)
  expect(await 그림수(page)).toBe(1)
  await expect(doc.locator('img')).toHaveCount(1)
})

test('Ctrl 을 누른 채 놓으면 워드처럼 복사된다', async ({ page }) => {
  await 준비(page)
  await 끌어놓기(page, { ctrl: true })
  await page.waitForTimeout(600)
  expect(await 그림수(page)).toBe(2)
})
