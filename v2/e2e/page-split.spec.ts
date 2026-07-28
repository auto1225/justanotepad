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

/** 리플로우가 멈출 때까지(쪽 배치가 연속 세 번 같을 때까지) 기다린다.
 *  블록 수·높이만 보면 다단 조판에서 아직 한 판 더 남았는데도 같아 보이는 순간이 있어,
 *  "아래 여백을 얼마나 넘었는가"까지 함께 본다. (넘친 채로 멈추면 그대로 검사에 걸린다) */
async function waitForReflow(page: import('@playwright/test').Page) {
  const snapshot = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')]
        .map((p) => {
          const el = p as HTMLElement
          const cs = getComputedStyle(el)
          const r = el.getBoundingClientRect()
          const limit = r.top + parseFloat(cs.paddingTop) + el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
          let over = 0
          for (const child of Array.from(el.children)) {
            for (const q of Array.from(child.getClientRects())) over = Math.max(over, q.bottom - limit)
          }
          return `${el.children.length}:${Math.round(r.height)}:${Math.round(over)}`
        })
        .join(',')
    )
  let prev = ''
  let stable = 0
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(150)
    const now = await snapshot()
    stable = now === prev && now !== '' ? stable + 1 : 0
    prev = now
    if (stable >= 3) return
  }
}

async function pageMetrics(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const pages = [...document.querySelectorAll('.jan-page-node')] as HTMLElement[]
    const style = getComputedStyle(pages[0])
    // 규격 높이 — 용지가 늘어난 상태에서도 흔들리지 않게 CSS 변수에서 직접 잰다
    const ruler = document.createElement('div')
    ruler.style.cssText = `position:absolute;visibility:hidden;height:${style.getPropertyValue('--jan-page-h') || '297mm'}`
    document.body.appendChild(ruler)
    const spec = ruler.getBoundingClientRect().height
    ruler.remove()
    const padBottom = parseFloat(style.paddingBottom)
    return {
      spec,
      count: pages.length,
      continued: document.querySelectorAll('[data-jan-cont]').length,
      grown: document.querySelectorAll('.jan-page-node[data-jan-grow]').length,
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

  test('2단으로 조판해도 쪽이 나뉜다 — 단을 다 채우고 다음 쪽으로 넘어간다', async ({ page }) => {
    // 논문 양식(2단)에서 쪽 나눔이 아예 꺼져 있던 적이 있다. 한 쪽에 다 쌓이면 안 된다.
    await page.getByRole('tab', { name: '논문' }).click()
    await page.getByRole('button', { name: /IEEE/ }).first().click()
    await page.waitForTimeout(1200)
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText(LONG_PARAGRAPH + LONG_PARAGRAPH)
    await waitForReflow(page)

    const m = await page.evaluate(() => {
      const pages = [...document.querySelectorAll('.jan-page-node')] as HTMLElement[]
      return {
        columns: Number(getComputedStyle(pages[0]).columnCount) || 1,
        fill: getComputedStyle(pages[0]).columnFill,
        count: pages.length,
        heights: pages.map((p) => Math.round(p.getBoundingClientRect().height)),
      }
    })
    expect(m.columns).toBe(2)
    expect(m.fill).toBe('auto') // 왼 단을 바닥까지 채우고 오른 단으로 넘어가야 한다
    expect(m.count).toBeGreaterThan(1)
    // 용지가 늘어나 한 장에 다 담기는 방식이면 안 된다 — 규격 높이를 지킨다
    expect(Math.max(...m.heights) - Math.min(...m.heights)).toBeLessThan(4)
  })

  test('지면 전체 폭을 쓰는 넓은 표도 아래 여백을 넘지 않는다', async ({ page }) => {
    // 단을 가로지르는 블록은 브라우저가 단을 더 만들지 않고 그냥 아래로 흘린다 —
    // 길이 합으로만 재던 시절에는 표가 아래 여백을 뚫고 내려갔다.
    await page.getByRole('tab', { name: '논문' }).click()
    await page.getByRole('button', { name: /IEEE/ }).first().click()
    await page.waitForTimeout(1200)
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const row = (n: number) => '<tr>' + Array.from({ length: 5 }, (_, c) => `<td><p>칸 ${n}-${c}</p></td>`).join('') + '</tr>'
      const wide = '<table><tbody>' + Array.from({ length: 8 }, (_, i) => row(i)).join('') + '</tbody></table>'
      const filler = '<p>' + '쪽을 채우기 위한 긴 문장입니다. '.repeat(220) + '</p>'
      const dt = new DataTransfer()
      dt.setData('text/html', filler + wide + filler + wide)
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)

    const worst = await page.evaluate(() => {
      let over = 0
      document.querySelectorAll('.jan-page-node').forEach((p) => {
        const el = p as HTMLElement
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        const limit = r.top + parseFloat(cs.paddingTop) + el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        for (const child of Array.from(el.children)) {
          for (const q of Array.from(child.getClientRects())) over = Math.max(over, q.bottom - limit)
        }
      })
      return Math.round(over)
    })
    // 여백 안쪽으로 들어와야 한다 (반올림 오차 2px 까지만 봐 준다)
    expect(worst).toBeLessThanOrEqual(2)
    expect(await page.locator('.jan-page-node').count()).toBeGreaterThan(1)
  })

  test('쪽을 오가며 정리해도 내용이 불어나지 않는다', async ({ page }) => {
    /* 넓은 표를 올렸다 내렸다 되풀이하던 시절, 그 왕복이 이어질수록 문서 뒷부분이
       통째로 복제됐다 (같은 절이 네 벌까지 늘어났다). 정리가 끝난 뒤 표식이
       정확히 한 번만 남아 있는지, 여러 번 건드려도 그대로인지 본다. */
    await page.getByRole('tab', { name: '논문' }).click()
    await page.getByRole('button', { name: /IEEE/ }).first().click()
    await page.waitForTimeout(1200)
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const row = (n: number) => '<tr>' + Array.from({ length: 5 }, (_, c) => `<td><p>칸 ${n}-${c}</p></td>`).join('') + '</tr>'
      const wide = '<table><tbody>' + Array.from({ length: 8 }, (_, i) => row(i)).join('') + '</tbody></table>'
      const filler = '<p>' + '쪽을 채우기 위한 긴 문장입니다. '.repeat(200) + '</p>'
      const dt = new DataTransfer()
      dt.setData('text/html', filler + wide + '<h2>고유표식절</h2><p>여기부터 끝까지가 복제되던 구간이다.</p>' + wide)
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)

    const count = () => page.evaluate(() => {
      const text = (document.querySelector('.ProseMirror') as HTMLElement).innerText
      return { marks: (text.match(/고유표식절/g) || []).length, tables: document.querySelectorAll('.ProseMirror table').length }
    })
    expect(await count()).toEqual({ marks: 1, tables: 2 })

    // 여러 번 건드려 리플로우를 다시 돌려도 그대로여야 한다
    // (쪽이 계속 다시 그려지는 중이라 클릭은 자리를 못 잡는다 — 편집기에 바로 초점을 준다)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
      await page.keyboard.press('Control+End')
      await page.keyboard.type('가')
      await page.keyboard.press('Backspace')
      await waitForReflow(page)
    }
    expect(await count()).toEqual({ marks: 1, tables: 2 })
  })

  test('표 캡션은 표와, 그림 캡션은 그림과 붙어 다닌다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const filler = '<p>' + '쪽을 채우기 위한 문장입니다. '.repeat(60) + '</p>'
      const html = filler
        + '<p data-paper-block="tabcap">Table 1. 표 캡션</p>'
        + '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>'
      const dt = new DataTransfer()
      dt.setData('text/html', html)
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)

    const split = await page.evaluate(() => {
      const cap = document.querySelector('p[data-paper-block="tabcap"]')
      if (!cap) return 'no-caption'
      const capPage = cap.closest('.jan-page-node')
      const table = document.querySelector('.jan-page-node table')
      const tablePage = table?.closest('.jan-page-node')
      return capPage === tablePage ? 'together' : 'apart'
    })
    expect(split).toBe('together')
  })

  test('한 쪽보다 긴 문단은 줄 경계에서 쪼개져 다음 쪽으로 이어진다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH)
    await waitForReflow(page)

    const m = await pageMetrics(page)

    // 1) 두 쪽 이상으로 나뉜다
    expect(m.count).toBeGreaterThanOrEqual(2)
    // 2) 쪼갠 뒷조각이 다음 쪽으로 넘어가 어떤 쪽도 규격을 넘기지 않는다
    //    (글만 있는 문서에서 용지가 늘어나면 안 된다 — 규격 그대로 유지)
    for (const p of m.pages) expect(p.overflow).toBeLessThanOrEqual(2)
    expect(m.grown).toBe(0)
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
    // (locator.click 은 화면 밖이면 스크롤해서 누른다 — 좌표 클릭은 빗나간다)
    const frag = page.locator('.jan-page-node').nth(1).locator('p').first()
    await frag.click()
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

  test('타자로 쪽을 넘길 때 용지가 한 프레임도 늘어나지 않는다', async ({ page }) => {
    // 한 쪽을 거의 채운 뒤부터 실제 타자로 경계를 넘긴다
    await page.keyboard.insertText(SENTENCE.repeat(26))
    await waitForReflow(page)

    // 프레임마다 가장 큰 용지 높이를 기록
    await page.evaluate(() => {
      const w = window as unknown as { __h: number[]; __raf: number }
      w.__h = []
      const tick = () => {
        const hs = [...document.querySelectorAll('.jan-page-node')].map((p) => p.getBoundingClientRect().height)
        if (hs.length) w.__h.push(Math.max(...hs))
        w.__raf = requestAnimationFrame(tick)
      }
      tick()
    })
    await page.keyboard.type(SENTENCE.repeat(5), { delay: 10 })
    await waitForReflow(page)

    const m = await pageMetrics(page)
    const over = await page.evaluate((spec) => {
      const w = window as unknown as { __h: number[]; __raf: number }
      cancelAnimationFrame(w.__raf)
      return { frames: w.__h.length, over: w.__h.filter((h) => h > spec + 1).length, max: Math.max(...w.__h) }
    }, m.spec)

    expect(over.frames).toBeGreaterThan(30) // 표본이 실제로 모였는지
    expect(over.over).toBe(0) // 타자 중 어느 프레임에서도 규격을 넘지 않는다
    expect(m.count).toBeGreaterThanOrEqual(2)
    expect(m.grown).toBe(0)
    // 규격에 묶였다고 글자가 잘려 사라지면 안 된다
    expect(m.text.replace(/\s+/g, '')).toBe(SENTENCE.repeat(31).replace(/\s+/g, ''))
  })

  test('쪼갤 수 없는 큰 표가 있는 쪽만 늘어나고, 표를 지우면 규격으로 돌아온다', async ({ page }) => {
    // 슬래시 명령으로 표를 넣고 Tab 으로 행을 늘려 한 쪽보다 크게 만든다
    await page.keyboard.type('/표')
    await page.waitForTimeout(600)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+End')
    for (let i = 0; i < 160; i++) await page.keyboard.press('Tab')
    await waitForReflow(page)

    const grown = await pageMetrics(page)
    expect(grown.grown).toBe(1) // 이 쪽만 예외로 늘어난다
    expect(grown.pages[0].height).toBeGreaterThan(grown.spec)
    // 늘어난 덕분에 표가 잘리지 않고 전부 보인다
    expect(
      await page.evaluate(() => {
        const p = document.querySelector('.jan-page-node') as HTMLElement
        const t = p.querySelector('table') as HTMLElement
        return t.getBoundingClientRect().bottom <= p.getBoundingClientRect().bottom + 1
      })
    ).toBe(true)

    // 표를 지우면 다시 규격 높이로
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.type('표를 지웠습니다.')
    await waitForReflow(page)
    const back = await pageMetrics(page)
    expect(back.grown).toBe(0)
    expect(back.pages[0].overflow).toBeLessThanOrEqual(2)
  })

  test('줄 간격을 줄이면 다음 쪽 내용이 줄 단위로 올라와 앞 쪽을 채운다', async ({ page }) => {
    await page.keyboard.insertText(LONG_PARAGRAPH.repeat(3))
    await waitForReflow(page)
    const before = await pageMetrics(page)
    expect(before.count).toBeGreaterThanOrEqual(3)

    // 문단 전체의 줄 간격을 좁힌다 (서식 도구 상자의 줄간격 입력칸)
    await page.keyboard.press('Control+a')
    const lineHeight = page.locator('input[aria-label="줄 간격"]')
    await lineHeight.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('1')
    await page.keyboard.press('Enter')
    await waitForReflow(page)

    const after = await pageMetrics(page)
    // 줄이 짧아진 만큼 뒷 쪽 내용이 올라와 쪽 수가 줄고, 앞 쪽은 계속 꽉 차 있다
    expect(after.count).toBeLessThan(before.count)
    // 마지막 쪽을 뺀 모든 쪽은 마지막 줄까지 차 있어야 한다 (구멍이 남으면 안 된다)
    after.pages.slice(0, -1).forEach((p) => expect(p.bottomGap).toBeLessThan(40))
    for (const p of after.pages) expect(p.overflow).toBeLessThanOrEqual(2)
    // 글자는 그대로
    expect(after.text.replace(/\s+/g, '')).toBe(before.text.replace(/\s+/g, ''))
  })

  test('제목만 쪽 바닥에 홀로 남지 않는다 (고아 제목)', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()

    // 제목 뒤에 목록이 오도록 채운다 — 앞 쪽에 자리가 남으면 제목만 끌어올려지기 쉬운 배치
    await page.evaluate(() => {
      const filler = Array.from({ length: 48 }, (_, i) => `<p>줄 ${i}</p>`).join('')
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', filler + '<h2>제목</h2><ul><li><p>항목 하나</p></li><li><p>항목 둘</p></li><li><p>항목 셋</p></li></ul><p>목록 뒤 문단</p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(2500)

    const tails = await page.evaluate(() => [...document.querySelectorAll('.jan-page-node')].map((p) => {
      const last = p.children[p.children.length - 1]
      return last ? last.tagName : ''
    }))
    expect(tails.length).toBeGreaterThan(1)
    expect(tails.filter((t) => /^H[1-6]$/.test(t))).toEqual([])
  })

  test('무거운 서식을 적용해도 리플로우가 폭주하지 않는다 (화면 멈춤 방지)', async ({ page }) => {
    // 리플로우가 스스로를 두 배씩 예약하면 몇 초 만에 탭이 멈춘다 — 프레임 요청 수로 감시한다
    await page.addInitScript(() => {
      const w = window as unknown as { __raf: number; requestAnimationFrame: typeof requestAnimationFrame }
      w.__raf = 0
      const raf = w.requestAnimationFrame.bind(window)
      w.requestAnimationFrame = (cb: FrameRequestCallback) => { w.__raf++; return raf(cb) }
    })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(400)

    await page.getByRole('tab', { name: '논문', exact: true }).click()
    await page.locator('.jan-ribbon-body .jan-ribbon-btn').filter({ hasText: /APA/ }).first().click()
    await page.waitForTimeout(1500)

    const frames = await page.evaluate(() => (window as unknown as { __raf: number }).__raf)
    expect(frames).toBeLessThan(200) // 폭주하면 1.5초에 수백~수천 회가 된다

    // 그리고 화면이 여전히 즉시 응답해야 한다
    const t0 = Date.now()
    await page.evaluate(() => document.querySelectorAll('.jan-page-node').length)
    expect(Date.now() - t0).toBeLessThan(600)
  })
})
