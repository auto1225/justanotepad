import { test, expect } from '@playwright/test'

/**
 * 그림을 고른 채 글자를 치거나 Enter 를 누르면 워드처럼 되어야 한다 —
 * 고른 그림이 사라지고 그 자리에 글자(또는 새 문단)가 선다.
 *
 * 글자는 처음부터 그랬다. Enter 는 아니었다: ProseMirror 의 기본(createParagraphNear)이
 * 그림을 **남기고** 그 아래에 문단을 하나 더 만들어, 같은 자리에서 두 키가 서로 다르게
 * 굴었다. 재어 보니 그림 1개가 그대로 남고 문단만 23→24 로 늘었다.
 *
 * 지운 뒤 조판 엔진이 그림 높이를 잔상으로 붙들고 있지 않은지도 함께 본다 —
 * 두 쪽짜리가 한 쪽으로 줄어야 한다.
 */

type W = {
  __janEditor: {
    commands: { setContent: (h: string) => void }
    chain: () => { focus: () => { setNodeSelection: (p: number) => { run: () => void } } }
    state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }
    view: { dom: HTMLElement }
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
    c.width = 300; c.height = 400
    const x = c.getContext('2d')!
    x.fillStyle = '#4488cc'; x.fillRect(0, 0, 300, 400)
    const 앞 = Array.from({ length: 22 }, (_, i) => `<p>채움 ${i + 1} — 두 쪽을 만들 만큼 글을 채운다.</p>`).join('')
    e.commands.setContent(`${앞}<img src="${c.toDataURL('image/png')}"><p>뒤</p>`)
  })
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForFunction(() => document.querySelectorAll('[data-jan-page]').length >= 2, null, { timeout: 20000 })
  await page.waitForTimeout(1200)
  /* 그림을 개체로 고른다 */
  await page.evaluate(() => {
    const e = (window as unknown as W).__janEditor
    let pos = -1
    e.state.doc.descendants((nd, p) => { if (nd.type.name === 'image' && pos < 0) pos = p })
    e.chain().focus().setNodeSelection(pos).run()
  })
  await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1)
  return doc
}

const 살핌 = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const e = (window as unknown as W).__janEditor
  let 그림 = 0
  e.state.doc.descendants((nd) => { if (nd.type.name === 'image') 그림 += 1 })
  return {
    그림,
    쪽: document.querySelectorAll('[data-jan-page]').length,
    문단: document.querySelectorAll('.ProseMirror p').length,
    글: e.view.dom.textContent || '',
  }
})

test('그림을 고르고 글자를 치면 그림이 사라지고 그 자리에 글자가 들어간다', async ({ page }) => {
  const doc = await 준비(page)
  const 전 = await 살핌(page)
  expect(전.쪽).toBe(2)
  await page.keyboard.type('가')
  await page.waitForTimeout(2000)
  const 후 = await 살핌(page)
  expect(후.그림).toBe(0)
  await expect(doc.locator('img')).toHaveCount(0)
  expect(후.글).toContain('가')
  /* 그림이 사라졌으니 두 쪽이 한 쪽으로 줄어야 한다 — 잔상 높이를 붙들고 있으면 그대로 2 다 */
  expect(후.쪽).toBe(1)
})

test('그림을 고르고 Enter 를 누르면 그림이 사라지고 그 자리에 새 문단이 선다', async ({ page }) => {
  const doc = await 준비(page)
  const 전 = await 살핌(page)
  expect(전.쪽).toBe(2)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)
  const 후 = await 살핌(page)
  expect(후.그림).toBe(0)            // 예전에는 1 이 그대로 남았다
  await expect(doc.locator('img')).toHaveCount(0)
  expect(후.문단).toBe(전.문단 + 1)  // 그림 자리에 문단이 하나 선다
  expect(후.쪽).toBe(1)              // 잔상 높이 없이 한 쪽으로 줄어야 한다

  /* 새 문단 안에 글자 자리가 놓여 바로 이어 칠 수 있어야 한다 */
  await page.keyboard.type('이어쓰기')
  await page.waitForTimeout(600)
  const 마무리 = await 살핌(page)
  expect(마무리.글).toContain('이어쓰기')
  expect(마무리.문단).toBe(전.문단 + 1)
})
