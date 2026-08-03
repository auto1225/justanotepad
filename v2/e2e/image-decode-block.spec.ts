import { test, expect } from '@playwright/test'

/**
 * 큰 그림을 끌어다 놓아도 그 순간 주 실이 오래 붙들리면 안 된다.
 *
 * 그림을 문서에 꽂으면 조판이 돌고, 브라우저는 그때 그림을 푼다(디코딩).
 * 둘이 한 프레임에 겹치면 그 프레임이 통째로 늘어나 타자가 늦어진다.
 * 재어 보니 4000×3000 짜리 WebP 에서 가장 오래 붙들린 프레임이 250ms 였다
 * (아무것도 안 넣었을 때는 18ms). 8MB 짜리 data: 글자 때문이 아니다 —
 * 같은 그림을 짧은 object 주소로 넣어도 250ms 였고, 미리 풀어 두고 넣으면 37ms 였다.
 *
 * 재는 법: 넣은 뒤 2초 동안 rAF 사이 간격을 재어 가장 긴 것을 본다.
 * rAF 를 두 번 기다리면 어떤 문서에서나 32ms 가 나와 바닥값에 가린다 — 한 번만 쓴다.
 */

test('큰 그림을 끌어다 놓아도 한 프레임이 오래 붙들리지 않는다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.evaluate(() => {
    const w = window as unknown as { __janEditor?: { commands: { clearContent: (b: boolean) => void } } }
    w.__janEditor?.commands.clearContent(true)
  })
  for (let i = 1; i <= 10; i += 1) {
    await page.keyboard.type(`문단 ${i} — 채우는 글.`)
    await page.keyboard.press('Enter')
  }
  await page.waitForTimeout(800)

  /* 먼저 바닥값 — 아무것도 안 넣고 같은 방법으로 잰다 */
  const base = await page.evaluate(() => new Promise<number>((done) => {
    const gaps: number[] = []
    const t0 = performance.now()
    let prev = t0
    const step = () => {
      const now = performance.now()
      gaps.push(now - prev); prev = now
      if (now - t0 < 1500) requestAnimationFrame(step)
      else done(Math.round(Math.max(...gaps)))
    }
    requestAnimationFrame(step)
  }))

  const worst = await page.evaluate(() => new Promise<number>((done) => {
    /* 4000×3000 잡음 그림 — 압축이 잘 안 먹어 푸는 값이 온전히 든다 */
    const cv = document.createElement('canvas')
    cv.width = 4000; cv.height = 3000
    const ctx = cv.getContext('2d')!
    const im = ctx.createImageData(4000, 3000)
    for (let i = 0; i < im.data.length; i += 4) {
      im.data[i] = (i * 7) & 255; im.data[i + 1] = (i * 13) & 255
      im.data[i + 2] = (i * 29) & 255; im.data[i + 3] = 255
    }
    ctx.putImageData(im, 0, 0)
    cv.toBlob((blob) => {
      const dom = document.querySelector('.ProseMirror') as HTMLElement
      const r = dom.getBoundingClientRect()
      const dt = new DataTransfer()
      dt.items.add(new File([blob!], 'big.webp', { type: 'image/webp' }))
      const gaps: number[] = []
      const t0 = performance.now()
      let prev = t0
      const step = () => {
        const now = performance.now()
        gaps.push(now - prev); prev = now
        if (now - t0 < 2500) requestAnimationFrame(step)
        else done(Math.round(Math.max(...gaps)))
      }
      dom.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: dt,
        clientX: r.left + 40, clientY: r.top + 40,
      }))
      requestAnimationFrame(step)
    }, 'image/webp', 0.92)
  }))

  console.log(`[decode] 바닥값 ${base}ms / 큰 그림 넣은 뒤 가장 긴 프레임 ${worst}ms`)
  await expect(doc.locator('img')).toHaveCount(1)
  /* 고치기 전에는 여기서 250ms 안팎이 나왔다. 바닥값이 20ms 남짓이므로 120ms 면
     넉넉히 사이가 벌어진다 — 기계가 느린 날에도 다투지 않게 여유를 둔다. */
  expect(worst).toBeLessThan(120)
})
