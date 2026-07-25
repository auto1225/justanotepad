import { test, expect } from '@playwright/test'

/**
 * 줄 단위 문단 분할 — 한 쪽을 글자로 꽉 채우고 넘치는 줄부터 다음 쪽으로 흘린다.
 * (독립 페이지 모델에서만 의미가 있다. 다른 모델이면 건너뛴다)
 */

const SENTENCE =
  '한 쪽을 글자로 꽉 채우는지 확인하기 위한 긴 문단입니다. 워드나 한글에서는 문단이 페이지 경계에 걸리면 ' +
  '들어갈 수 있는 줄까지만 앞 쪽에 남기고 나머지 줄은 다음 쪽으로 흘러갑니다. 문단을 통째로 넘기면 앞 쪽 ' +
  '바닥에 일곱 여덟 줄이 비어 버립니다. '
const LONG_PARAGRAPH = SENTENCE.repeat(30)
const USER_BREAK = '사용자가나눈문단'

/** 저장·내보내기에 쓰이는 HTML — getSavableHtml 과 같은 변환(용지 벗기기 + 조각 합치기) */
async function savedHtml(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const wrap = document.createElement('div')
    wrap.innerHTML = (document.querySelector('.ProseMirror') as HTMLElement).innerHTML
    wrap.querySelectorAll('div[data-jan-page]').forEach((pg) => {
      const parent = pg.parentNode!
      while (pg.firstChild) parent.insertBefore(pg.firstChild, pg)
      parent.removeChild(pg)
    })
    let target = wrap.querySelector('[data-jan-cont]')
    let guard = 0
    while (target && guard++ < 500) {
      const prev = target.previousElementSibling
      if (prev) {
        while (target.firstChild) prev.appendChild(target.firstChild)
        target.remove()
      } else {
        target.removeAttribute('data-jan-cont')
      }
      target = wrap.querySelector('[data-jan-cont]')
    }
    return wrap.innerHTML
  })
}

/** 리플로우가 멈출 때까지(쪽 배치가 연속 세 번 같을 때까지) 기다린다 */
async function waitForReflow(page: import('@playwright/test').Page) {
  const snapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')]
        .map((p) => `${p.children.length}:${Math.round(p.getBoundingClientRect().height)}`)
        .join(',')
    )
  let prev = ''
  let stable = 0
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(150)
    const now = await snapshot()
    stable = now === prev && now !== '' ? stable + 1 : 0
    prev = now
    if (stable >= 2) return
  }
}

async function pageMetrics(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const pages = [...document.querySelectorAll('.jan-page-node')] as HTMLElement[]
    const style = getComputedStyle(pages[0])
    const spec = parseFloat(style.minHeight)
    const padBottom = parseFloat(style.paddingBottom)
    return {
      spec,
      count: pages.length,
      continued: document.querySelectorAll('[data-jan-cont]').length,
      pages: pages.map((p) => {
        const r = p.getBoundingClientRect()
        const last = p.lastElementChild as HTMLElement | null
        return {
          height: r.height,
          overflow: r.height - spec,
          blocks: p.children.length,
          chars: (p.textContent ?? '').replace(/\s+/g, '').length,
          // 마지막 줄과 아래 여백 사이에 남은 빈 자리
          bottomGap: last ? r.bottom - padBottom - last.getBoundingClientRect().bottom : 0,
        }
      }),
      text: (document.querySelector('.ProseMirror') as HTMLElement | null)?.innerText ?? '',
    }
  })
}

test.describe('줄 단위 문단 분할', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    const model = await page.evaluate(
      () => document.querySelector('[data-page-model]')?.getAttribute('data-page-model') ?? ''
    )
    test.skip(model !== 'nodes', `독립 페이지 모델이 아님 (${model})`)
    // 앞 시험의 내용이 섞이지 않게 새 메모에서 시작한다
    await page.getByRole('button', { name: '새 메모', exact: true }).first().click()
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
  })

  test('한 쪽보다 긴 문단은 줄 경계에서 쪼개져 다음 쪽으로 이어진다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH)
    await waitForReflow(page)

    const m = await pageMetrics(page)

    // 1) 두 쪽 이상으로 나뉜다
    expect(m.count).toBeGreaterThanOrEqual(2)
    // 2) 쪼갠 뒷조각이 다음 쪽으로 넘어가 어떤 쪽도 규격을 넘기지 않는다
    for (const p of m.pages) expect(p.overflow).toBeLessThanOrEqual(2)
    // 3) 문단 단위가 아니라 줄 단위로 잘렸다 — 앞 쪽 바닥에 한 줄 넘게 비지 않는다
    expect(m.pages[0].bottomGap).toBeLessThan(40)
    // 4) 이어짐 표시가 붙어 저장할 때 원래 한 문단으로 합쳐진다
    expect(m.continued).toBeGreaterThanOrEqual(1)
    // 5) 글자가 사라지지 않는다
    const typed = LONG_PARAGRAPH.replace(/\s+/g, '')
    expect(m.text.replace(/\s+/g, '')).toBe(typed)
  })

  test('저장본에서는 쪼갠 조각이 원래 한 문단으로 합쳐진다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH)
    await waitForReflow(page)

    const html = await page.evaluate(
      () => (document.querySelector('.ProseMirror') as HTMLElement).innerHTML
    )
    expect(html).toContain('data-jan-cont')

    // 편집기 화면에서는 쪼개져 있어도, 저장 경로를 거친 HTML 은 문단 하나로 돌아와야 한다
    const saved = await savedHtml(page)
    expect(saved).not.toContain('data-jan-cont')
    expect(saved.match(/<p/g)?.length ?? 0).toBe(1)
  })

  test('이어짐 조각 안에서 엔터를 치면 나눈 문단이 저장본에도 남는다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH)
    await waitForReflow(page)

    // 둘째 쪽 조각 한가운데에 커서를 놓고 문단을 나눈 뒤 이어서 쓴다
    const frag = page.locator('.jan-page-node').nth(1).locator('p').first()
    const box = (await frag.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.press('Enter')
    await page.keyboard.type(USER_BREAK)
    await waitForReflow(page)

    // 나눈 뒤쪽 문단까지 이어짐 표시를 물려받으면 저장할 때 앞 문단에 흡수돼 사라진다
    const saved = await savedHtml(page)
    expect(saved).toMatch(new RegExp(`<p[^>]*>${USER_BREAK}`))
  })

  test('앞부분을 지우면 뒷조각이 줄 단위로 되돌아와 앞 쪽을 다시 채운다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH)
    await waitForReflow(page)
    const before = await pageMetrics(page)
    expect(before.count).toBeGreaterThanOrEqual(2)

    // 문단 앞에서 열다섯 줄을 지운다 → 앞 쪽에 그만큼 자리가 빈다
    await page.keyboard.press('Control+Home')
    for (let i = 0; i < 15; i++) await page.keyboard.press('Shift+ArrowDown')
    await page.keyboard.press('Shift+End')
    await page.keyboard.press('Delete')
    await waitForReflow(page)

    const after = await pageMetrics(page)
    // 뒷조각이 지운 만큼 올라와 앞 쪽은 여전히 마지막 줄까지 차 있다
    expect(after.pages[0].bottomGap).toBeLessThan(40)
    expect(after.pages[1].chars).toBeLessThan(before.pages[1].chars)
    for (const p of after.pages) expect(p.overflow).toBeLessThanOrEqual(2)
    // 내용을 넘겨받은 쪽에 빈 문단만 남은 유령 쪽이 생기지 않는다
    for (const p of after.pages) expect(p.blocks).toBe(1)
    // 앞에서만 지웠으므로 남은 글은 원래 글의 뒷부분 그대로다
    const strip = (s: string) => s.replace(/\s+/g, '')
    expect(strip(before.text).endsWith(strip(after.text))).toBe(true)
  })
})
