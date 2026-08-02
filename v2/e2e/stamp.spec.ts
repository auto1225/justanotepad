import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 도장 — 결재란에 「(인)」 이라 적어 두고 인쇄해서 손으로 찍던 일을 문서 안에서 끝낸다.
 *
 * 도장은 종이 위에 얹는 물건이라 두 가지가 지켜져야 쓸모가 있다.
 * 하나, 커서가 있던 자리에 얹혀야 한다 — 이 앱의 그림은 블록이라 그냥 넣으면
 * 문단 뒤 제 줄 왼쪽 끝에 가서 서고, 그러면 결재란에 못 쓴다.
 * 둘, 글자 자리가 뚫려 있어야 한다 — 흰 바탕이 깔리면 밑에 있는 서명줄을 지운다.
 */

async function ready(page: Page) {
  await page.goto('./')
  await page.evaluate(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    localStorage.removeItem('jan-v2-stamps')
  })
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  return doc
}

async function openStamp(page: Page) {
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label^="도장"]').first().click()
  const dlg = page.locator('.jan-stampdlg')
  await expect(dlg).toBeVisible()
  return dlg
}

test('이름을 적으면 미리보기에 도장이 새겨진다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  const dlg = await openStamp(page)

  const canvas = dlg.locator('canvas')
  /* 아직 빈 판이다 */
  expect(await inkRatio(page)).toBe(0)

  await dlg.locator('input[aria-label="새길 글자"]').fill('홍길동')
  await expect(canvas).toBeVisible()
  /* 이제 판에 인장이 찍혔다 — 미리보기가 도는지가 아니라 정말 그려졌는지를 본다 */
  expect(await inkRatio(page)).toBeGreaterThan(0.3)
})

test('찍으면 커서가 있던 자리에 얹힌다 — 제 줄 왼쪽 끝이 아니다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  await page.keyboard.type('위와 같이 확인함.        2026년 8월 3일        대표이사  홍 길 동  (인)')

  /* 커서는 줄 끝, 「(인)」 뒤에 있다 */
  const caretX = await page.evaluate(() => {
    const p = document.querySelector('.ProseMirror p') as HTMLElement
    const t = p.firstChild as Text
    const r = document.createRange()
    r.setStart(t, t.length - 1)
    r.setEnd(t, t.length)
    return r.getBoundingClientRect().right
  })

  const dlg = await openStamp(page)
  await dlg.locator('input[aria-label="새길 글자"]').fill('홍길동')
  await dlg.locator('.jan-stampdlg-size button', { hasText: '15mm' }).first().click()
  await dlg.locator('.jan-modal-foot button', { hasText: '도장 찍기' }).first().click()

  const img = doc.locator('img').first()
  await expect(img).toHaveCount(1)
  await expect(img).toHaveAttribute('data-wrap', 'front')
  await expect(img).toHaveAttribute('data-dx', /\d/) // 커서 자리로 밀리기를 기다린다

  /* 줄 끝 가까이에 있다 — 왼쪽 끝에 서 있으면 여기서 걸린다 */
  const box = await img.boundingBox()
  const line = await page.evaluate(() => {
    const p = document.querySelector('.ProseMirror p') as HTMLElement
    const r = p.getBoundingClientRect()
    return { left: r.left, top: r.top, bottom: r.bottom }
  })
  expect(box).not.toBeNull()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  expect(Math.abs(cx - caretX)).toBeLessThan(30)
  expect(cx - line.left).toBeGreaterThan(100) // 왼쪽 끝이 아니다
  /* 세로로도 그 줄에 얹혀 있다 */
  expect(cy).toBeGreaterThan(line.top - 40)
  expect(cy).toBeLessThan(line.bottom + 40)
})

test('글자 자리가 뚫려 있다 — 밑에 있는 글을 지우지 않는다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  await page.keyboard.type('대표이사  홍 길 동  (인)')
  const dlg = await openStamp(page)
  await dlg.locator('input[aria-label="새길 글자"]').fill('홍길동')
  await dlg.locator('.jan-modal-foot button', { hasText: '도장 찍기' }).first().click()
  await expect(doc.locator('img')).toHaveCount(1)

  const seen = await page.evaluate(async () => {
    const img = document.querySelector('.ProseMirror img') as HTMLImageElement
    if (!img.complete) await new Promise((r) => { img.onload = r })
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    const R = c.width / 2, cx = R, cy = c.height / 2
    let inClear = 0, inInk = 0, cornerClear = 0, corner = 0
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        const a = d[(y * c.width + x) * 4 + 3]
        const d2 = (x - cx) ** 2 + (y - cy) ** 2
        if (d2 < (R * 0.8) ** 2) { if (a < 40) inClear += 1; else inInk += 1 }
        else if (d2 > (R * 1.05) ** 2) { corner += 1; if (a < 40) cornerClear += 1 }
      }
    }
    return { inClear, inInk, cornerClear, corner }
  })

  /* 인장 안에 뚫린 자리가 있다 — 글자를 파낸 자리다 */
  expect(seen.inClear).toBeGreaterThan(0)
  expect(seen.inClear / (seen.inClear + seen.inInk)).toBeGreaterThan(0.02)
  /* 원 바깥은 통째로 비어 있다 — 네모난 흰 바탕이 깔리면 밑줄이 지워진다 */
  expect(seen.cornerClear / seen.corner).toBeGreaterThan(0.95)
})

test('서랍에 넣어 두면 다음에 그대로 꺼내 찍는다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  let dlg = await openStamp(page)
  await dlg.locator('input[aria-label="새길 글자"]').fill('대표이사인')
  await dlg.locator('.jan-modal-foot button', { hasText: '서랍에 넣기' }).first().click()
  await page.locator('.jan-modal-close').first().click()

  /* 껐다 켜도 서랍에 남아 있다 */
  await page.reload()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  dlg = await openStamp(page)
  await dlg.locator('.jan-stampdlg-ways button', { hasText: '서랍' }).first().click()
  const kept = dlg.locator('.jan-stampdlg-drawer li')
  await expect(kept).toHaveCount(1)
  await expect(kept.first()).toContainText('대표이사인')

  await kept.first().locator('button').first().click()
  await expect(doc.locator('img')).toHaveCount(1)
})

test('찍은 도장은 껐다 켜도 그 자리에 남는다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  await page.keyboard.type('결재            대표이사  홍 길 동')
  const dlg = await openStamp(page)
  await dlg.locator('input[aria-label="새길 글자"]').fill('홍길동')
  await dlg.locator('.jan-modal-foot button', { hasText: '도장 찍기' }).first().click()
  const img = doc.locator('img').first()
  await expect(img).toHaveCount(1)
  await expect(img).toHaveAttribute('data-dx', /\d/)
  /* 화면 좌표가 아니라 글줄에서 얼마나 떨어져 있는지를 잰다 — 그림을 넣으면 리본이
     「그림」 탭으로 바뀌어 본문이 통째로 아래위로 밀린다. 그건 도장이 움직인 것이 아니다. */
  const before = await offsetFromLine(page)

  await page.keyboard.press('Control+s')
  await page.waitForTimeout(1500)
  await page.reload()
  await doc.waitFor({ state: 'visible' })
  await page.waitForTimeout(1500)

  const after = doc.locator('img').first()
  await expect(after).toHaveCount(1)
  /* 빈자리 표시가 아니라 진짜 그림이다 */
  await expect(after).not.toHaveAttribute('data-jan-blob-missing', /.*/)
  expect(await after.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(50)
  const now = await offsetFromLine(page)
  expect(Math.abs(now.dx - before.dx)).toBeLessThan(4)
  expect(Math.abs(now.dy - before.dy)).toBeLessThan(4)
})

/** 도장이 글줄에서 얼마나 떨어져 앉아 있는지 */
async function offsetFromLine(page: Page): Promise<{ dx: number; dy: number }> {
  return page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img') as HTMLElement
    const line = document.querySelector('.ProseMirror p') as HTMLElement
    const a = img.getBoundingClientRect()
    const b = line.getBoundingClientRect()
    return { dx: Math.round(a.left - b.left), dy: Math.round(a.top - b.top) }
  })
}

/** 미리보기 판에 실제로 찍힌 점의 몫 */
async function inkRatio(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.jan-stampdlg-preview canvas') as HTMLCanvasElement | null
    if (!c) return 0
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let on = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) on += 1
    return on / (c.width * c.height)
  })
}
