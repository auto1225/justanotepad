import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'

/**
 * 저장소를 거치는 그림은 한 번 물리면 그것으로 끝나야 한다.
 *
 * 예전에는 끝이 없었다. 그림 알맹이를 화면에 물리는 일(src 쓰기) 자체가 DOM 을 고치는
 * 일이고, 그것을 지켜보던 MutationObserver 가 깨어나 또 물렸다. 같은 값을 넣어도
 * 브라우저는 「고쳐졌다」 고 알리므로 50ms 마다 끝없이 돌았다.
 *
 * 그 사이 편집기는 노드를 다시 그리며 src 를 1×1 빈 그림으로 되돌린다. 그림은 1×1 과
 * 제 크기 사이를 오가고, 크기가 바뀔 때마다 조판이 다시 돌아 쪽 수가 7 과 9 를 오갔다.
 * 그래서 그림은 끝내 자리를 잡지 못하고 화면에 나타나지 않았다 — DOM 에는 멀쩡히
 * 있고 알맹이도 다 실려 있는데도.
 */

const BIG = path.join(process.cwd(), 'e2e', 'fixtures', 'big.png')

async function ready(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  return doc
}

test('저장소 그림을 끝없이 다시 물리지 않는다 — 화면이 떨리지 않는다', async ({ page }) => {
  const doc = await ready(page)
  await doc.click()
  await page.keyboard.type('저장소를 거치는 그림')

  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(BIG)
  await expect(doc.locator('img')).toHaveCount(1)

  await page.keyboard.press('Control+s')
  await page.waitForTimeout(1500)
  await page.reload()
  await doc.waitFor({ state: 'visible' })
  await page.waitForTimeout(2500) // 자리 잡을 틈을 준다

  /* 자리 잡은 뒤로는 아무도 src 를 건드리지 않아야 한다 */
  const seen = await page.evaluate(async () => {
    const root = document.querySelector('.ProseMirror')!
    let writes = 0
    const pages = new Set<number>()
    const mo = new MutationObserver((rs) => {
      for (const r of rs) if (r.attributeName === 'src') writes += 1
    })
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['src'] })
    for (let i = 0; i < 12; i += 1) {
      pages.add(root.querySelectorAll('[data-jan-page]').length)
      await new Promise((r) => setTimeout(r, 250))
    }
    mo.disconnect()
    const img = root.querySelector('img') as HTMLImageElement | null
    const rect = img?.getBoundingClientRect()
    return {
      writes,
      쪽수들: [...pages],
      나온크기: img ? { nw: img.naturalWidth, nh: img.naturalHeight } : null,
      화면크기: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      빈그림인가: (img?.getAttribute('src') || '').startsWith('data:image/gif'),
    }
  })

  /* 되풀이가 있으면 3초에 60번 가까이 쓴다 */
  expect(seen.writes).toBeLessThan(5)
  /* 쪽 수가 오락가락하지 않는다 */
  expect(seen.쪽수들).toHaveLength(1)
  /* 그림은 빈 그림이 아니라 진짜다 */
  expect(seen.빈그림인가).toBe(false)
  expect(seen.나온크기!.nw).toBeGreaterThan(100)
  expect(seen.화면크기!.h).toBeGreaterThan(40)
})

test('알맹이가 오기 전에도 그림이 제 자리를 잡아 둔다', async ({ page }) => {
  /* 1×1 빈 그림을 그대로 두면 높이가 0으로 잡혀 조판이 한 번 되고, 그림이 온 뒤
     다시 조판된다 — 쪽이 통째로 밀린다. 원래 크기를 아니 비율을 미리 일러 둔다. */
  const doc = await ready(page)
  await doc.click()
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(BIG)
  await expect(doc.locator('img')).toHaveCount(1)
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(1500)

  /* 그림이 화면에 처음 붙는 순간의 높이를 잡아 둔다 — 그때는 아직 빈 그림이다 */
  await page.addInitScript(() => {
    const w = window as unknown as { __firstBox?: { h: number; blank: boolean } | null }
    w.__firstBox = null
    const look = () => {
      if (w.__firstBox) return
      const img = document.querySelector('.ProseMirror img')
      if (!img) return
      const h = Math.round(img.getBoundingClientRect().height)
      if (h <= 0) return
      w.__firstBox = { h, blank: (img.getAttribute('src') || '').startsWith('data:image/gif') }
    }
    new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true })
  })

  await page.reload()
  const img = page.locator('.ProseMirror img').first()
  await img.waitFor({ state: 'attached' })
  await page.waitForTimeout(3000)

  const first = await page.evaluate(() => (window as unknown as { __firstBox: { h: number; blank: boolean } | null }).__firstBox)
  const 늦은자리 = await img.evaluate((el) => Math.round(el.getBoundingClientRect().height))

  expect(늦은자리).toBeGreaterThan(40)
  expect(first).not.toBeNull()
  /* 아직 빈 그림이던 그때에도 거의 같은 높이를 차지하고 있었다 —
     그래야 진짜 그림이 와도 쪽이 밀리지 않는다 */
  expect(first!.blank).toBe(true)
  expect(Math.abs(first!.h - 늦은자리)).toBeLessThan(20)
})
