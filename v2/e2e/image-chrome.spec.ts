import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import { readFileSync } from 'node:fs'

/**
 * 그림을 다루는 동안 화면이 서로를 가리지 않아야 한다.
 *
 *  하나. 창이 뜨면 개체 손잡이·도구막대는 물러난다. 둘 다 문서 위에 떠 있는 장식이라
 *        창보다 위에 그려지는데(560 · 610 대 200), 그러면 「그림 속성」 창 글씨 위로
 *        도구막대가 얹혀 어느 것이 위인지 알 수 없었다.
 *  둘.  자르기는 한 번 끌어 끝내는 일이 아니다. 값을 줄 때마다 그림 노드가 새로 그려지고
 *        그 찰나에 브라우저 커서가 자리를 잃는데, 그것만 보고 자르기를 끝내 버려서
 *        한 번 끌 때마다 자르기가 저절로 풀렸다.
 *
 * 밝혀 둘 것: 둘째 시험은 지금 그 고장을 가려내지 못한다 — 「끄는 동안 그림의 자리를
 * 붙든다」 는 앞선 고침이 고름이 풀리는 것 자체를 막아 주어서, 유예를 빼도 통과한다.
 * 여기서 지키는 것은 「두 번 나눠 끌어도 자르기가 이어진다」 는 약속뿐이다.
 */

const BIG = path.join(process.cwd(), 'e2e', 'fixtures', 'big.png')
const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

/* 자르기가 저절로 풀리는 것은 무거운 문서라야 드러난다 — 값을 줄 때마다 쪽 나눔이 함께
   돌아 고름을 흔든다. 그림 하나짜리 문서에서는 쪽이 다시 짜일 일이 없어 풀리지 않는다. */
async function 강의노트(page: Page) {
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
  return doc
}

async function 그림하나(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('그림 다루기')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(BIG)
  await expect(doc.locator('img')).toHaveCount(1)
  await page.waitForTimeout(1200)
  await doc.locator('img').first().click()
  await expect(page.locator('.jan-ih-dot')).toHaveCount(8)
  return doc
}

test('창이 뜨면 손잡이와 도구막대가 물러난다', async ({ page }) => {
  await 그림하나(page)
  await expect(page.locator('.jan-object-bar')).toBeVisible()

  /* 도구막대의 「속성」 으로 그림 속성 창을 연다 */
  await page.locator('.jan-object-bar button', { hasText: '속성' }).first().click()
  const dlg = page.locator('.jan-modal-overlay')
  await expect(dlg).toBeVisible()

  /* 창이 떠 있는 동안에는 둘 다 보이지 않는다 */
  await expect(page.locator('.jan-object-bar')).toBeHidden()
  await expect(page.locator('.jan-img-handles')).toBeHidden()

  /* 창을 닫으면 다시 돌아온다 */
  await page.keyboard.press('Escape')
  await expect(dlg).toHaveCount(0)
  await expect(page.locator('.jan-object-bar')).toBeVisible()
})

test('자르기는 한 번 끌었다고 저절로 풀리지 않는다', async ({ page }) => {
  const doc = await 강의노트(page)

  /* 자르기 모드로 들어간다 */
  await page.locator('.jan-object-bar button', { hasText: '자르기' }).first().click()
  await expect(page.locator('.jan-ih-dot.is-crop')).toHaveCount(8)

  const 끌기 = async (n: number) => {
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
    for (let i = 1; i <= 3; i += 1) {
      await page.mouse.move(se.x - i * n, se.y - i * n)
      await page.waitForTimeout(90)
    }
    await page.mouse.up()
    await page.waitForTimeout(700)
  }

  await 끌기(6)
  /* 여기서 자르기가 풀리면 「한 번 끌 때마다 다시 켜야」 한다 */
  await expect(page.locator('.jan-ih-dot.is-crop')).toHaveCount(8)

  /* 이어서 한 번 더 다듬는다 — 자르기는 보통 이렇게 여러 번 나눠 맞춘다 */
  await 끌기(5)
  await expect(page.locator('.jan-ih-dot.is-crop')).toHaveCount(8)

  const crop = await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string }; attrs: Record<string, unknown> }) => void) => void } } } }).__janEditor
    let v = ''
    e.state.doc.descendants((n) => { if (!v && n.type.name === 'image') v = String(n.attrs.crop || '') })
    return v
  })
  expect(crop).not.toBe('')
  void doc
})
