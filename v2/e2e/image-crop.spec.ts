import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

/**
 * 자르면 워드처럼 상자 자체가 줄어야 한다 — 잘린 자리에 흰 공백이 남으면 안 된다.
 *
 * 두 군데가 어긋나 있었다.
 *  하나. 위로 미는 몫에 1/kh 가 한 번 더 곱해져 있었다. 320×240 그림의 위아래를 4분의 1씩
 *        자르면 60px 만 올려야 하는데 120px 을 올려 엉뚱한 띠가 보였고, 위를 40% 자르면
 *        그림이 상자 위로 통째로 빠져나가 72px 이 흰 자리로 남았다.
 *  둘.  넘치게 놓아야 할 그림에 max-width:100% 가 걸려 가로로는 아예 넘치지 못했다.
 *        빗장을 푸는 규칙(span.jan-img-clip 안쪽)이 있었는데 캡션 없는 그림은 그 span 을
 *        쓰지 않고 있었다. 좌우를 30% 자르면 상자만 320×600 으로 길어지고 그림은 320×240
 *        그대로라 아래에 360px 흰 공백이 남았다.
 *
 * 그래서 여기서 재는 것은 「그림이 상자를 빈틈없이 덮는가」 와 「보이는 띠가 자른 값과
 * 맞는가」 다. 눈으로 보이는 고장을 그대로 숫자로 옮긴 것이다.
 */

const BIG = path.join(process.cwd(), 'e2e', 'fixtures', 'big.png') // 320×240
const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

/** 상자와 그림의 자리를 잰다 — 상자는 잘라 내는 span(없으면 그림 자신) */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img.jan-img-el') as HTMLImageElement
    const clip = img.closest('span.jan-img-clip') as HTMLElement | null
    const box = (clip || img).getBoundingClientRect()
    const pic = img.getBoundingClientRect()
    const ed = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string }; attrs: Record<string, unknown> }) => void) => void } } } }).__janEditor
    let attrs: Record<string, unknown> = {}
    ed.state.doc.descendants((n) => { if (!attrs.__ && n.type.name === 'image') attrs = { __: 1, ...n.attrs } })
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, w: box.width, h: box.height },
      pic: { left: pic.left, top: pic.top, right: pic.right, bottom: pic.bottom, w: pic.width, h: pic.height },
      crop: String(attrs.crop || ''),
      width: String(attrs.width || ''),
      cropped: !!clip,
    }
  })
}

/** 그림이 상자를 빈틈없이 덮는가 — 어느 쪽에도 흰 자리가 없어야 한다 */
function 빈자리없음(g: Awaited<ReturnType<typeof geometry>>) {
  expect(Math.round(g.pic.top - g.box.top)).toBeLessThanOrEqual(1)
  expect(Math.round(g.pic.left - g.box.left)).toBeLessThanOrEqual(1)
  expect(Math.round(g.box.bottom - g.pic.bottom)).toBeLessThanOrEqual(1)
  expect(Math.round(g.box.right - g.pic.right)).toBeLessThanOrEqual(1)
}

async function 새문서에그림(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('자르기')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(BIG)
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(1800) // 원래 크기(data-nw)를 읽을 틈
  await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }; commands: { setNodeSelection: (p: number) => void } } }).__janEditor
    let pos = -1
    e.state.doc.descendants((n, p) => { if (pos < 0 && n.type.name === 'image') pos = p })
    e.commands.setNodeSelection(pos)
  })
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)
  return doc
}

test('위아래를 자르면 그 띠만 보이고 아래에 흰 자리가 남지 않는다', async ({ page }) => {
  await 새문서에그림(page)
  const 처음 = await geometry(page)
  expect(Math.round(처음.box.w)).toBe(320)
  expect(Math.round(처음.box.h)).toBe(240)

  /* 위를 40%, 아래를 10% 자른다 (Alt+Shift+방향키 — 한 번에 2%) */
  for (let i = 0; i < 20; i += 1) await page.keyboard.press('Alt+Shift+ArrowUp')
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Alt+Shift+ArrowDown')
  await page.waitForTimeout(500)

  const g = await geometry(page)
  expect(g.cropped).toBe(true)
  빈자리없음(g)

  /* 상자는 남는 몫(50%)만큼만 남는다 — 워드처럼 상자 자체가 줄어든다 */
  expect(g.box.h).toBeGreaterThan(240 * 0.5 - 3)
  expect(g.box.h).toBeLessThan(240 * 0.5 + 3)
  expect(Math.round(g.box.w)).toBe(320) // 가로는 안 잘랐다

  /* 보이는 띠가 잘라 낸 값과 맞다 — 위에서 40% 내려온 자리부터다.
     1/kh 가 한 번 더 곱해져 있던 시절에는 이 값이 0.8 로 나왔다. */
  expect((g.box.top - g.pic.top) / g.pic.h).toBeCloseTo(0.4, 2)
  /* 그림 자체는 잘리기 전 크기 그대로다 — 배율이 바뀌지 않는다 (비파괴) */
  expect(Math.round(g.pic.h)).toBe(240)
})

test('좌우를 자르면 상자가 좁아지고 그림이 그 상자를 가득 덮는다', async ({ page }) => {
  await 새문서에그림(page)

  for (let i = 0; i < 15; i += 1) await page.keyboard.press('Alt+Shift+ArrowLeft')
  for (let i = 0; i < 15; i += 1) await page.keyboard.press('Alt+Shift+ArrowRight')
  await page.waitForTimeout(500)

  const g = await geometry(page)
  expect(g.cropped).toBe(true)
  빈자리없음(g)

  /* 남는 몫 40% — 상자는 128px 로 좁아지고 높이는 그대로 240px 이다.
     max-width 에 막혀 그림이 넘치지 못하던 시절에는 상자가 320×600 이 되고
     그림은 320×240 이라 아래에 360px 흰 공백이 남았다. */
  expect(g.box.w).toBeGreaterThan(320 * 0.4 - 3)
  expect(g.box.w).toBeLessThan(320 * 0.4 + 3)
  expect(Math.round(g.box.h)).toBe(240)
  expect((g.box.left - g.pic.left) / g.pic.w).toBeCloseTo(0.3, 2)
})

test('자르기를 지우면 원본이 온전히 돌아온다', async ({ page }) => {
  await 새문서에그림(page)
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowUp')
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowLeft')
  await page.waitForTimeout(400)
  expect((await geometry(page)).cropped).toBe(true)

  await page.keyboard.press('Alt+x')
  await page.waitForTimeout(400)
  const g = await geometry(page)
  expect(g.crop).toBe('')
  expect(Math.round(g.box.w)).toBe(320)
  expect(Math.round(g.box.h)).toBe(240)
})

test('크기를 정해 둔 그림을 자르면 상자만 줄고 그림은 확대되지 않는다', async ({ page }) => {
  await 새문서에그림(page)
  /* 400px 로 키운 뒤 좌우를 각각 20% 자른다 */
  await page.evaluate(async () => {
    const m = await import('/v2/src/lib/imageWord.ts')
    m.setImageWidth((window as unknown as { __janEditor: never }).__janEditor, '400px')
  })
  await page.waitForTimeout(400)
  const 전 = await geometry(page)
  expect(Math.round(전.box.w)).toBe(400)

  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowLeft')
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowRight')
  await page.waitForTimeout(500)

  const g = await geometry(page)
  빈자리없음(g)
  /* 워드는 자른다고 그림을 키우지 않는다 — 그림은 400×300 그대로, 상자만 240px 로 줄어든다 */
  expect(Math.round(g.pic.w)).toBe(400)
  expect(Math.round(g.pic.h)).toBe(300)
  expect(g.box.w).toBeGreaterThan(400 * 0.6 - 4)
  expect(g.box.w).toBeLessThan(400 * 0.6 + 4)
})

test('자르는 동안 잘려 나가는 부분이 흐리게 보인다 (워드의 자르기 미리보기)', async ({ page }) => {
  await 새문서에그림(page)
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowUp')
  await page.waitForTimeout(400)

  await expect(page.locator('.jan-ih-ghost')).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('jan-image-crop-mode')))
  await page.waitForTimeout(400)

  const 미리보기 = page.locator('.jan-ih-ghost')
  await expect(미리보기).toHaveCount(1)
  const g = await geometry(page)
  const ghost = (await 미리보기.boundingBox())!
  /* 흐린 그림은 잘리기 전 그림 전체를 덮는다 — 잘려 나간 자리가 어디였는지 보인다 */
  expect(ghost.height).toBeGreaterThan(g.box.h + 10)
  expect(Math.round(ghost.height)).toBe(Math.round(g.pic.h))
  /* 남는 부분은 또렷하게 덮여 있다 */
  await expect(page.locator('.jan-ih-keep')).toHaveCount(1)

  await page.evaluate(() => window.dispatchEvent(new Event('jan-image-crop-mode')))
  await page.waitForTimeout(300)
  await expect(미리보기).toHaveCount(0)
})

test('무거운 문서에서 자르기 손잡이를 끌면 손잡이가 커서를 따라온다', async ({ page }) => {
  /* 쪽이 여럿이고 그림이 다섯인 문서 — 자를 때마다 쪽 나눔이 함께 돌아
     고름이 흔들린다. 그림 하나짜리 문서에서는 드러나지 않는다. */
  const b64 = readFileSync(JAN).toString('base64')
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.addInitScript((s: string) => {
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => {
      const bin = atob(s); const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
      return [{ kind: 'file', name: 'x.jan', getFile: async () => new File([buf], 'x.jan') }]
    }
  }, b64)
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
  await expect(doc.locator('img')).toHaveCount(5, { timeout: 30000 })
  await page.waitForTimeout(12000)

  await doc.locator('img').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }; commands: { setNodeSelection: (p: number) => void } } }).__janEditor
    let pos = -1
    e.state.doc.descendants((n, p) => { if (pos < 0 && n.type.name === 'image') pos = p })
    e.commands.setNodeSelection(pos)
  })
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)
  /* 이미 한 번 잘라 둔 그림에서 다시 끈다 — 자르기는 여러 번 나누어 맞추는 일이고,
     화면에서 움직인 거리를 상자 크기로 나누던 셈법은 안 잘린 그림에서만 맞았다 */
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowRight')
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('Alt+Shift+ArrowDown')
  await page.waitForTimeout(600)
  await page.evaluate(() => window.dispatchEvent(new Event('jan-image-crop-mode')))
  await page.waitForTimeout(400)

  /** 오른쪽 아래 손잡이의 자리 (손잡이가 하나도 없으면 null) */
  const 손잡이 = () => page.evaluate(() => {
    const dots = [...document.querySelectorAll('.jan-ih-dot')] as HTMLElement[]
    if (!dots.length) return null
    const p = dots.reduce((a, b) => {
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect()
      return rb.x + rb.y > ra.x + ra.y ? b : a
    })
    const r = p.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })

  const se = (await 손잡이())!
  const 처음 = await geometry(page)
  await page.mouse.move(se.x, se.y)
  await page.mouse.down()
  const 가로어긋남: number[] = []
  const 상자너비: number[] = []
  let 손잡이사라짐 = 0
  for (let i = 1; i <= 5; i += 1) {
    const 목표 = { x: se.x - i * 16, y: se.y - i * 12 }
    await page.mouse.move(목표.x, 목표.y)
    await page.waitForTimeout(140)
    const 지금 = await 손잡이()
    if (!지금) { 손잡이사라짐 += 1; continue }
    /* 세로는 쪽 나눔이 글을 밀고 당기며 상자를 몇 px 옮기므로 가로로만 잰다 */
    가로어긋남.push(Math.abs(지금.x - 목표.x))
    상자너비.push(Math.round((await geometry(page)).box.w))
  }
  await page.mouse.up()
  await page.waitForTimeout(500)

  /* 끄는 내내 손잡이가 떠 있다 — 자르기 값을 한 번 줄 때마다 그림 노드가 다시 그려지고
     쪽 나눔이 돌면서 고름이 글자 고름으로 떨어지는데, 그것을 보고 손잡이를 걷어 버리면
     걸음마다 손잡이가 통째로 사라졌다 (여기서 다섯 번 다 사라졌었다) */
  expect(손잡이사라짐).toBe(0)
  /* 손잡이가 커서를 따라온다.
     ① 자르기 값을 상자 크기로 나누던 시절에는 이미 잘린 만큼 배로 잘려 달아났고,
     ② 본문보다 넓은 그림(원본 1640px, 본문 730px)은 max-width 에 걸려 화면에서 이미
        줄어 있는데 원본 너비에서 셈하는 바람에 절반 넘게 자를 때까지 상자가 꿈쩍도
        하지 않아 손잡이가 오른쪽 끝에 붙박여 있었다 (어긋남 16·32·48·64·80px). */
  for (const d of 가로어긋남) expect(d).toBeLessThan(4)
  /* 상자가 걸음마다 줄어든다 */
  for (let i = 1; i < 상자너비.length; i += 1) expect(상자너비[i]).toBeLessThan(상자너비[i - 1])
  const g = await geometry(page)
  expect(g.box.w).toBeLessThan(처음.box.w - 50)
  빈자리없음(g)
})

test('채우기는 상자를 지키고, 맞춤은 그림 전체를 상자 안에 넣는다', async ({ page }) => {
  await 새문서에그림(page)
  /* 비율 고정을 풀고 300×300 상자를 만든다 (워드의 「크기」 대화상자와 같은 길) */
  await page.evaluate(async () => {
    const m = await import('/v2/src/lib/imageWord.ts')
    const ed = (window as unknown as { __janEditor: never }).__janEditor
    m.toggleAspectLock(ed)
    m.setImageAttrs(ed, { width: '300px', height: '300px' })
  })
  await page.waitForTimeout(400)
  expect(Math.round((await geometry(page)).box.h)).toBe(300)

  await page.evaluate(async () => {
    const m = await import('/v2/src/lib/imageWord.ts')
    m.fillBox((window as unknown as { __janEditor: never }).__janEditor)
  })
  await page.waitForTimeout(400)
  const 채움 = await geometry(page)
  /* 상자는 그대로 300×300, 그림이 그 상자를 빈틈없이 덮는다 */
  expect(Math.round(채움.box.w)).toBe(300)
  expect(Math.round(채움.box.h)).toBe(300)
  빈자리없음(채움)
  expect(채움.crop).not.toBe('')

  await page.evaluate(async () => {
    const m = await import('/v2/src/lib/imageWord.ts')
    m.fitBox((window as unknown as { __janEditor: never }).__janEditor)
  })
  await page.waitForTimeout(400)
  const 맞춤 = await geometry(page)
  /* 자르기가 풀리고 그림 전체가 300×300 안에 들어온다 (4:3 이므로 300×225) */
  expect(맞춤.crop).toBe('')
  expect(Math.round(맞춤.box.w)).toBe(300)
  expect(Math.round(맞춤.box.h)).toBe(225)
})
