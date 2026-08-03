import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

/**
 * 손잡이를 끌면 놓을 때까지 크기가 따라와야 한다.
 *
 * 예전에는 첫 걸음만 먹고 풀려 버렸다. 크기를 한 번 바꾸면 그림 노드가 새로 그려지는데,
 * 브라우저 커서가 그 자리를 잃으면서 편집기가 「글자 고름」 으로 되돌린다
 * (문서도 안 바뀌고 이름표도 없는 트랜잭션이 그것이다). 그러면 그다음 걸음부터는
 * 「고른 그림」 이 없어 아무 일도 일어나지 않는다 — 「조금 줄어들다 풀려버린다」 가 이것이다.
 *
 * 그래서 끄는 동안에는 고름에 기대지 않고 그림의 자리를 직접 붙들고 간다.
 */

/* 무거운 문서라야 드러난다 — 크기를 바꿀 때마다 쪽 나눔이 함께 돌아 고름을 흔든다.
   그림 하나짜리 문서에서는 예전 코드로도 잘 끌린다. */
const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

async function openLecture(page: Page) {
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
  return doc
}

test('손잡이를 끄는 내내 크기가 따라오고, 놓아도 고른 채로 남는다', async ({ page }) => {
  const doc = await openLecture(page)
  const img = doc.locator('img').first()
  await img.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  /* 그림을 고른다 (이 시험이 보는 것은 「고르기」 가 아니라 「끌기」 다) */
  await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string } }, p: number) => void) => void } }; commands: { setNodeSelection: (p: number) => void } } }).__janEditor
    let pos = -1
    e.state.doc.descendants((n, p) => { if (pos < 0 && n.type.name === 'image') pos = p })
    e.commands.setNodeSelection(pos)
  })
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)

  const before = Math.round((await img.boundingBox())!.width)
  /* 오른쪽 아래 손잡이 — 여덟 개 가운데 x+y 가 가장 큰 것 */
  const se = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('.jan-ih-dot')] as HTMLElement[]
    const pick = dots.reduce((a, b) => {
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect()
      return rb.x + rb.y > ra.x + ra.y ? b : a
    })
    const r = pick.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })

  await page.mouse.move(se.x, se.y)
  await page.mouse.down()
  const 걸음: number[] = []
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(se.x - i * 20, se.y - i * 12)
    await page.waitForTimeout(110)
    걸음.push(Math.round((await img.boundingBox())!.width))
  }
  await page.mouse.up()
  await page.waitForTimeout(500)

  /* 걸음마다 줄어든다 — 첫 걸음만 먹고 풀리면 여기서 걸린다 */
  expect(new Set(걸음).size).toBeGreaterThanOrEqual(5)
  for (let i = 1; i < 걸음.length; i += 1) expect(걸음[i]).toBeLessThan(걸음[i - 1])
  expect(걸음[걸음.length - 1]).toBeLessThan(before - 80)

  /* 놓은 뒤에도 고른 채로 남아 바로 더 다룰 수 있다 */
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)
})

test('끄는 동안 그림이 계속 보인다 — 빈 자리에서 크기만 바뀌지 않는다', async ({ page }) => {
  /* 저장소를 거치는 그림(jan-blob://)이라야 드러난다. 크기를 바꾸면 노드가 새로 그려지며
     src 가 1×1 빈 그림으로 돌아가는데, 진짜 그림을 다시 물리는 데 50ms 가 걸린다.
     손잡이를 끄는 동안에는 걸음마다 그 일이 되풀이되어 그림이 내내 안 보였다. */
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('저장소를 거치는 그림')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(path.join(process.cwd(), 'e2e', 'fixtures', 'big.png'))
  await expect(doc.locator('img')).toHaveCount(1)
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(1500)
  await page.reload()
  await doc.waitFor({ state: 'visible' })
  await page.waitForTimeout(2500)

  const img = doc.locator('img').first()
  await expect(img).toHaveAttribute('data-blob-ref', /jan-blob/)
  await img.click()
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)

  const se = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('.jan-ih-dot')] as HTMLElement[]
    const pick = dots.reduce((a, b) => {
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect()
      return rb.x + rb.y > ra.x + ra.y ? b : a
    })
    const r = pick.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  await page.mouse.move(se.x, se.y)
  await page.mouse.down()
  const 빈번 = { blank: 0, total: 0 }
  for (let i = 1; i <= 8; i += 1) {
    /* 움직인 바로 그 순간을 잰다 — 기다렸다 재면 빈 구간(50ms)이 이미 지나가 버린다.
       사람 눈에는 그 구간이 「그림이 사라진 채로 크기만 바뀌는」 것으로 보인다. */
    await page.mouse.move(se.x - i * 14, se.y - i * 10)
    const s = await page.evaluate(() => {
      const im = document.querySelector('.ProseMirror img') as HTMLImageElement
      return { blank: (im.getAttribute('src') || '').startsWith('data:image/gif'), drawn: im.naturalWidth > 2 }
    })
    빈번.total += 1
    if (s.blank || !s.drawn) 빈번.blank += 1
    await page.waitForTimeout(70)
  }
  await page.mouse.up()
  await page.waitForTimeout(400)

  /* 끄는 내내 진짜 그림이 붙어 있어야 한다 */
  expect(빈번.blank).toBe(0)
})
