import { test, expect } from '@playwright/test'

/**
 * 같은 자리의 그림을 다른 그림으로 갈아 끼우면 치수도 함께 갈려야 한다.
 *
 * 우리는 원래 크기(data-nw·data-nh)를 「한 번 적고 다시 안 적는」 값으로 두고 있었다.
 * 그 값으로 예약 상자(aspect-ratio)를 걸어 두므로, 200×200 자리에 500×800 그림이
 * 들어오면 상자는 200×200 인 채 그림만 찌그러진다. 재어 보니:
 *
 *   200×200 그림                 data-nw 200/200 · aspect 200/200 · 화면 200×200
 *   같은 노드에 500×800 을 넣음   data-nw 200/200 · aspect 200/200 · 화면 200×200   ← 그대로다
 *   같은 노드에 700×2600 을 넣음  화면 200×200 · 쪽 1 · 문서 높이 1,123px           ← 쪽도 안 밀린다
 *
 * 그림을 갈아 끼우는 길은 하나가 아니다(그림 바꾸기 · 그림 편집 · 형식 바꾸기 · 그리기판).
 * 그래서 부르는 쪽마다 지우게 하지 않고, 화면에 물린 그림과 적어 둔 값이 어긋나면
 * 다시 재도록 고쳤다. 사람이 손으로 정한 width 는 워드처럼 그대로 지킨다.
 *
 * 화면에 걸리는 것을 보아야 하므로 속성만이 아니라 getComputedStyle·
 * getBoundingClientRect 로 잰다.
 */

type Win = Window & {
  __janEditor?: {
    state: { doc: { descendants: (f: (n: unknown, p: number) => void) => void } }
    chain: () => {
      focus: () => {
        setNodeSelection: (p: number) => {
          updateAttributes: (t: string, a: Record<string, unknown>) => { run: () => void }
        }
      }
    }
    commands: { clearContent: (b: boolean) => void; setImage: (a: Record<string, unknown>) => void }
  }
}

async function boot(page: import('@playwright/test').Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  /* 앞 시험이 남긴 것이 저장소에서 되살아난다 — 비우고 시작해야 「지금 넣은 그림」 을 잰다 */
  await page.evaluate(() => { (window as Win).__janEditor?.commands.clearContent(true) })
  await expect(page.locator('.ProseMirror img.jan-img-el')).toHaveCount(0)
  await page.waitForTimeout(200)
  return doc
}

/** 캔버스로 만든 단색 PNG — 치수를 마음대로 정할 수 있다 */
function png(page: import('@playwright/test').Page, w: number, h: number, color: string) {
  return page.evaluate(({ w, h, color }) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const x = c.getContext('2d')!
    x.fillStyle = color; x.fillRect(0, 0, w, h)
    return c.toDataURL('image/png')
  }, { w, h, color })
}

async function putImage(page: import('@playwright/test').Page, src: string) {
  await page.evaluate((s) => { (window as Win).__janEditor?.commands.setImage({ src: s }) }, src)
  await expect(page.locator('.ProseMirror img.jan-img-el[data-nw]')).toHaveCount(1, { timeout: 10000 })
  await page.waitForTimeout(500)
}

/** 그림 노드의 src 만 갈아 끼운다 — 「그림 편집」·그리기판이 지나는 길 그대로 */
async function swapSrc(page: import('@playwright/test').Page, src: string) {
  await page.evaluate((s) => {
    const ed = (window as Win).__janEditor!
    let pos = -1
    ed.state.doc.descendants((n, p) => {
      if ((n as { type: { name: string } }).type.name === 'image' && pos < 0) pos = p
    })
    ed.chain().focus().setNodeSelection(pos).updateAttributes('image', { src: s }).run()
  }, src)
}

/** 화면에 걸린 것 */
async function shown(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img.jan-img-el') as HTMLImageElement | null
    if (!img) return null
    const r = img.getBoundingClientRect()
    return {
      nw: Number(img.getAttribute('data-nw')) || 0,
      nh: Number(img.getAttribute('data-nh')) || 0,
      natural: [img.naturalWidth, img.naturalHeight] as [number, number],
      aspect: getComputedStyle(img).aspectRatio,
      w: Math.round(r.width),
      h: Math.round(r.height),
      pages: document.querySelectorAll('[data-jan-page]').length,
    }
  })
}

test('그림을 다른 파일로 바꾸면 예약 상자가 새 비율로 다시 잡힌다', async ({ page }) => {
  await boot(page)
  const 작은것 = await png(page, 200, 200, '#2a7')
  const 긴것 = await png(page, 500, 800, '#a27')

  await putImage(page, 작은것)
  const 전 = await shown(page)
  expect(전).toMatchObject({ nw: 200, nh: 200, w: 200, h: 200 })

  await swapSrc(page, 긴것)

  await expect(async () => {
    const 후 = await shown(page)
    /* 브라우저가 물린 그림은 이미 500×800 이다 — 적어 둔 값도 거기 맞아야 한다 */
    expect(후?.natural).toEqual([500, 800])
    expect(후?.nw).toBe(500)
    expect(후?.nh).toBe(800)
    /* 화면에 실제로 걸리는 것 — 예약 상자의 비율과 그려진 크기 */
    expect(후?.aspect.replace(/\s/g, '')).toBe('500/800')
    expect(후?.w).toBe(500)
    expect(후?.h).toBe(800)
  }).toPass({ timeout: 8000 })
})

test('그림이 커지면 뒤 글이 다음 쪽으로 밀린다', async ({ page }) => {
  const doc = await boot(page)
  const 작은것 = await png(page, 200, 200, '#2a7')
  const 아주큰것 = await png(page, 700, 2600, '#a27')

  /* 그림 뒤에 한 쪽을 채우지 못할 만큼의 글 — 그림이 자라야만 다음 쪽이 생긴다 */
  await doc.click()
  for (let i = 0; i < 22; i += 1) {
    await page.keyboard.type(`${i} 뒤에 오는 글월이다. 그림이 자라면 이 줄이 다음 쪽으로 밀린다.\n`)
  }
  await page.keyboard.press('Control+Home')
  await page.waitForTimeout(400)

  await putImage(page, 작은것)
  expect((await shown(page))?.pages).toBe(1)

  await swapSrc(page, 아주큰것)

  await expect(async () => {
    const 후 = await shown(page)
    expect(후?.nh).toBe(2600)
    expect(후?.h).toBeGreaterThan(2000)
    expect(후?.pages).toBeGreaterThan(1)
  }).toPass({ timeout: 10000 })
})

test('손으로 정한 크기는 그림을 바꿔도 그대로 남는다', async ({ page }) => {
  await boot(page)
  const 작은것 = await png(page, 200, 200, '#2a7')
  const 긴것 = await png(page, 500, 800, '#a27')

  await putImage(page, 작은것)
  /* 사람이 폭을 120px 로 못박는다 */
  await page.evaluate(() => {
    const ed = (window as Win).__janEditor!
    let pos = -1
    ed.state.doc.descendants((n, p) => {
      if ((n as { type: { name: string } }).type.name === 'image' && pos < 0) pos = p
    })
    ed.chain().focus().setNodeSelection(pos).updateAttributes('image', { width: '120px' }).run()
  })
  await page.waitForTimeout(400)
  expect((await shown(page))?.w).toBe(120)

  await swapSrc(page, 긴것)

  await expect(async () => {
    const 후 = await shown(page)
    expect(후?.nw).toBe(500)
    /* 폭은 사람이 정한 120px 그대로, 높이만 새 비율(500:800)을 따른다 */
    expect(후?.w).toBe(120)
    expect(후?.h).toBe(192)
  }).toPass({ timeout: 8000 })
})
