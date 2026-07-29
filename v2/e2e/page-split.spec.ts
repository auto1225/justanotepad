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
    /* 쪽 경계에서 나뉜 표도 도로 한 표로 (앱의 mergeContinuedTables 와 같은 변환).
       화면에서는 표 속성이 껍데기(.tableWrapper)에 얹혀 있으므로 먼저 표로 옮긴다 —
       저장 경로(getHTML)는 문서에서 직접 뽑아 이 단계가 필요 없다. */
    wrap.querySelectorAll('.tableWrapper[data-cont]').forEach((w) => {
      const table = w.querySelector('table')
      if (table) table.setAttribute('data-cont', '1')
    })
    wrap.querySelectorAll('.tableWrapper').forEach((w) => {
      const parent = w.parentNode!
      while (w.firstChild) parent.insertBefore(w.firstChild, w)
      parent.removeChild(w)
    })
    let cont = wrap.querySelector('table[data-cont]')
    let tableGuard = 0
    while (cont && tableGuard++ < 500) {
      let prev: Element | null = cont.previousElementSibling
      while (prev && prev.tagName !== 'TABLE') prev = prev.previousElementSibling
      if (prev) {
        const body = prev.querySelector('tbody') || prev
        cont.querySelectorAll('tr[data-repeated]').forEach((row) => row.remove())
        cont.querySelectorAll('tr').forEach((row) => body.appendChild(row))
        cont.remove()
      } else {
        cont.removeAttribute('data-cont')
      }
      cont = wrap.querySelector('table[data-cont]')
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
    await page.getByRole('tab', { name: '자료' }).click()
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
    await page.getByRole('tab', { name: '자료' }).click()
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
    await page.getByRole('tab', { name: '자료' }).click()
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

  test('표 자리·너비를 지정하면 그대로 조판된다 (단 안 / 단 걸치기 / 내용 맞춤)', async ({ page }) => {
    /* 표는 열 너비 조절용 노드뷰가 제 DOM 을 만들어서, 표에 건 속성이 화면에 닿지 않았다.
       속성 → 껍데기(.tableWrapper) → CSS 로 이어지는 길이 살아 있는지 본다. */
    await page.getByRole('tab', { name: '자료' }).click()
    await page.getByRole('button', { name: /IEEE/ }).first().click()
    await page.waitForTimeout(1200)
    await page.locator('.jan-page-node').first().click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const row = (n: number) => '<tr>' + Array.from({ length: 5 }, (_, c) => `<td><p>칸 ${n}-${c}</p></td>`).join('') + '</tr>'
      const table = (attr: string) => `<table ${attr}><tbody>${row(0)}${row(1)}</tbody></table>`
      const dt = new DataTransfer()
      dt.setData('text/html',
        '<p>자리를 고르지 않은 표</p>' + table('') +
        '<p>단 안에 두기</p>' + table('data-place="column"') +
        '<p>내용에 맞춤</p>' + table('data-place="column" data-fit="contents"'))
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)

    const tables = await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror .tableWrapper')].map((el) => {
        const wrap = el as HTMLElement
        const table = wrap.querySelector('table') as HTMLElement
        return {
          place: wrap.getAttribute('data-place'),
          fit: wrap.getAttribute('data-fit'),
          span: getComputedStyle(wrap).columnSpan,
          width: Math.round(table.getBoundingClientRect().width),
        }
      })
    )
    expect(tables).toHaveLength(3)
    // 자리를 고르지 않은 표는 열이 5개라 자동으로 단을 걸친다
    expect(tables[0]).toMatchObject({ place: null, span: 'all' })
    // 단 안에 두기를 고른 표는 단 폭으로 줄어든다
    expect(tables[1]).toMatchObject({ place: 'column', span: 'none' })
    expect(tables[1].width).toBeLessThan(tables[0].width)
    // 내용에 맞춤은 단 폭보다도 좁아진다
    expect(tables[2]).toMatchObject({ fit: 'contents', span: 'none' })
    expect(tables[2].width).toBeLessThanOrEqual(tables[1].width)
  })

  test('셀 수식은 워드 문법으로 계산하고, 값이 바뀌면 다시 계산한다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const cell = (text: string, formula?: string) =>
        `<td${formula ? ` data-formula="${formula}" data-num-format="#,##0"` : ''}><p>${text}</p></td>`
      const dt = new DataTransfer()
      dt.setData('text/html',
        '<table><tbody>' +
        '<tr><th><p>지점</p></th><th><p>1분기</p></th><th><p>합계</p></th></tr>' +
        '<tr>' + cell('서울') + cell('1,200') + cell('', '=SUM(LEFT)') + '</tr>' +
        '<tr>' + cell('부산') + cell('800') + cell('', '=SUM(LEFT)') + '</tr>' +
        '<tr>' + cell('합계') + cell('', '=SUM(ABOVE)') + cell('', '=SUM(ABOVE)') + '</tr>' +
        '</tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(600)

    const readRows = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((tr) =>
        [...tr.children].map((c) => (c as HTMLElement).textContent?.trim() ?? '')))

    expect(await readRows()).toEqual([
      ['지점', '1분기', '합계'],
      ['서울', '1,200', '1,200'],
      ['부산', '800', '800'],
      ['합계', '2,000', '2,000'],
    ])

    // 값을 고치면 스스로 다시 계산한다 (워드는 F9 를 눌러야 한다)
    await page.evaluate(() => {
      const cell = document.querySelectorAll('.ProseMirror table tr')[1].children[1] as HTMLElement
      const range = document.createRange()
      range.selectNodeContents(cell)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
    })
    await page.keyboard.type('2000')
    await page.waitForTimeout(600)

    const after = await readRows()
    expect(after[1][2]).toBe('2,000') // 서울 합계
    expect(after[3][1]).toBe('2,800') // 1분기 총합
  })

  test('표 손잡이 — 워드처럼 전체·행·열 선택, 크기 조절, 자리 옮기기', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html',
        '<p>앞 문단</p><table><tbody>' +
        '<tr><th><p>가</p></th><th><p>나</p></th><th><p>다</p></th></tr>' +
        '<tr><td><p>1</p></td><td><p>2</p></td><td><p>3</p></td></tr>' +
        '<tr><td><p>4</p></td><td><p>5</p></td><td><p>6</p></td></tr>' +
        '</tbody></table><p>뒤 문단</p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })
    await expect(page.locator('.jan-th-move')).toHaveCount(1)

    const selected = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror .selectedCell')].map((c) => c.textContent?.trim() ?? ''))

    // 이동 손잡이를 누르면 표 전체가 선택된다 (예전에는 문서 전체가 선택됐다)
    // 누르면 표 전체가 선택된다 (누르기만 하고 떼면 자리는 그대로다)
    await page.evaluate(() => {
      const handle = document.querySelector('.jan-th-move') as HTMLElement
      const r = handle.getBoundingClientRect()
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left, clientY: r.top }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left, clientY: r.top }))
    })
    expect((await selected()).length).toBe(9)

    // 가장자리 띠를 누르면 그 행·열만 선택된다
    await page.locator('.jan-th-row').nth(1).click()
    expect(await selected()).toEqual(['1', '2', '3'])
    await page.locator('.jan-th-col').nth(1).click()
    expect(await selected()).toEqual(['나', '2', '5'])

    // 손잡이는 커서가 표에 있는 동안 눈에 보여야 한다 —
    // 예전에는 pointer-events:none 인 층에 :hover 를 걸어 둬서 영영 나타나지 않았다
    const visible = await page.evaluate(() =>
      ['.jan-th-size', '.jan-th-add', '.jan-th-col'].map((sel) =>
        Number(getComputedStyle(document.querySelector(sel) as HTMLElement).opacity)))
    for (const opacity of visible) expect(opacity).toBeGreaterThan(0.3)

    // 오른쪽 아래 손잡이를 끌면 표 전체 너비가 바뀐다
    const widthOf = () => page.evaluate(() =>
      Math.round((document.querySelector('.ProseMirror table') as HTMLElement).getBoundingClientRect().width))
    const before = await widthOf()
    await page.evaluate(() => {
      const table = document.querySelector('.ProseMirror table') as HTMLElement
      const r = table.getBoundingClientRect()
      const handle = document.querySelector('.jan-th-size') as HTMLElement
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.right, clientY: r.bottom }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: r.right - 150, clientY: r.bottom }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.right - 150, clientY: r.bottom }))
    })
    expect(await widthOf()).toBeLessThan(before - 80)

    // 이동 손잡이를 아래로 끌면 표가 다음 블록 뒤로 간다
    const blocks = () => page.evaluate(() => {
      const host = document.querySelector('.jan-page-node') || document.querySelector('.ProseMirror')!
      return [...host.children].map((el) => (el.querySelector('table') || el.tagName === 'TABLE' ? '표' : (el.textContent || '').trim()))
    })
    expect(await blocks()).toEqual(['앞 문단', '표', '뒤 문단'])
    await page.evaluate(() => {
      const handle = document.querySelector('.jan-th-move') as HTMLElement
      const r = handle.getBoundingClientRect()
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left, clientY: r.top }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: r.left, clientY: r.top + 40 }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left, clientY: r.top + 60 }))
    })
    await page.waitForTimeout(300)
    expect(await blocks()).toEqual(['앞 문단', '뒤 문단', '표'])
  })

  test('표 높이 — 행 경계를 끌면 그 행만, 모서리를 끌면 표 전체가 늘어난다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    const rowHeights = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((r) => Math.round(r.getBoundingClientRect().height)))

    const start = await rowHeights()
    // 둘째 행의 아래 경계를 끌어 내린다 — 그 행만 높아져야 한다
    await page.evaluate(() => {
      const strip = document.querySelectorAll('.jan-th-rowsize')[1] as HTMLElement
      const s = strip.getBoundingClientRect()
      strip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: s.left + 40, clientY: s.top + 2 }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: s.left + 40, clientY: s.top + 32 }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: s.left + 40, clientY: s.top + 32 }))
    })
    const afterRow = await rowHeights()
    expect(afterRow[0]).toBe(start[0])                    // 첫 행은 그대로
    expect(afterRow[1]).toBeGreaterThan(start[1] + 20)    // 둘째 행만 높아졌다

    // 모서리를 아래로 끌면 표 전체가 비율대로 늘어난다
    await page.evaluate(() => {
      const table = document.querySelector('.ProseMirror table') as HTMLElement
      const r = table.getBoundingClientRect()
      const handle = document.querySelector('.jan-th-size') as HTMLElement
      handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.right, clientY: r.bottom }))
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: r.right, clientY: r.bottom + 60 }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.right, clientY: r.bottom + 60 }))
    })
    const afterCorner = await rowHeights()
    expect(afterCorner[0]).toBeGreaterThan(afterRow[0])
    expect(afterCorner[1]).toBeGreaterThan(afterRow[1])
  })

  test('행 경계를 누르기만 하면 높이가 바뀌지 않고 커서가 놓인다', async ({ page }) => {
    // 경계 띠가 본문 클릭을 삼키면 글을 만질 수 없다
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    const before = await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((r) => r.getAttribute('data-height')))
    await page.evaluate(() => {
      const strip = document.querySelectorAll('.jan-th-rowsize')[0] as HTMLElement
      const s = strip.getBoundingClientRect()
      strip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: s.left + 40, clientY: s.top + 2 }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: s.left + 40, clientY: s.top + 2 }))
    })
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((r) => r.getAttribute('data-height')))
    expect(after).toEqual(before)
  })

  test('표를 마우스 없이 키보드만으로 다룬다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody>' +
        '<tr><th><p>머리</p></th><th><p>둘</p></th></tr>' +
        '<tr><td><p>A</p></td><td><p>1</p></td></tr>' +
        '<tr><td><p>B</p></td><td><p>2</p></td></tr>' +
        '</tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    const selected = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror .selectedCell')].map((c) => c.textContent?.trim() ?? ''))
    const rows = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((r) => r.textContent?.trim() ?? ''))
    const shape = () => page.evaluate(() => ({
      rows: document.querySelectorAll('.ProseMirror table tr').length,
      cols: document.querySelectorAll('.ProseMirror table tr:first-child > *').length,
    }))

    // 행·열·표 선택
    await page.keyboard.press('Alt+r')
    expect(await selected()).toEqual(['A', '1'])
    await page.keyboard.press('Alt+a')
    expect((await selected()).length).toBe(6)

    // 커서를 되돌리고 행·열 삽입
    await page.locator('.ProseMirror table td').first().click({ force: true })
    const start = await shape()
    await page.keyboard.press('Alt+i')
    expect(await shape()).toMatchObject({ rows: start.rows + 1 })
    await page.keyboard.press('Alt+o')
    expect(await shape()).toMatchObject({ cols: start.cols + 1 })

    // 행 옮기기 (워드의 Shift+Alt+↑/↓)
    await page.locator('.ProseMirror table td').first().click({ force: true })
    /* 커서를 'A' 칸에 두고 그 행이 한 칸 내려가는지 본다.
       (몇 번째 행인지로만 확인하면 앞서 넣은 빈 행 때문에 자리가 흔들린다) */
    await page.locator('.ProseMirror table td').filter({ hasText: /^A$/ }).first().click()
    const rowOfA = async () => (await rows()).findIndex((t) => t.startsWith('A'))
    const beforeIndex = await rowOfA()
    await page.keyboard.press('Shift+Alt+ArrowDown')
    await expect.poll(rowOfA).toBe(beforeIndex + 1)

    // 열 너비를 같게
    await page.keyboard.press('Alt+e')
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table colgroup col')].map((c) => (c as HTMLElement).style.width))
    expect(new Set(widths).size).toBe(1) // 모두 같은 너비
    expect(widths[0]).toMatch(/px$/)
  })

  test('셀을 고른 뒤 방향키로 열 너비·행 높이를 늘이고 줄인다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody>' +
        '<tr><th><p>가</p></th><th><p>나</p></th><th><p>다</p></th></tr>' +
        '<tr><td><p>1</p></td><td><p>2</p></td><td><p>3</p></td></tr>' +
        '</tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    const colWidths = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table colgroup col')].map((c) => (c as HTMLElement).style.width))
    const rowHeights = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror table tr')].map((r) => Math.round(r.getBoundingClientRect().height)))

    // 첫 열을 고른다
    await page.keyboard.press('Alt+c')
    expect(await page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror .selectedCell')].map((c) => c.textContent?.trim())))
      .toEqual(['가', '1'])

    // 오른쪽 방향키로 넓히고, 왼쪽으로 좁힌다 (고른 열만)
    await page.keyboard.press('Alt+ArrowRight')
    const wide = await colWidths()
    expect(wide[0]).toMatch(/px$/)
    expect(wide[1]).toBe('')      // 고르지 않은 열은 그대로
    await page.keyboard.press('Alt+ArrowLeft')
    const narrow = await colWidths()
    expect(parseFloat(narrow[0])).toBeLessThan(parseFloat(wide[0]))

    // 아래 방향키로 행 높이를 키운다
    const before = await rowHeights()
    await page.keyboard.press('Alt+ArrowDown')
    const after = await rowHeights()
    expect(after[0]).toBeGreaterThan(before[0])
  })

  test('Shift+F10 으로 표 상황 메뉴를 열고 키보드로 고른다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    await page.keyboard.press('Shift+F10')
    const menu = page.locator('.jan-table-ctx')
    await expect(menu).toBeVisible()
    // 첫 항목에 초점이 가 있어야 화살표로 이어 갈 수 있다
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Enter') // 위에 행 삽입
    await expect(page.locator('.ProseMirror table tr')).toHaveCount(3)
  })

  test('긴 표는 쪽 경계에서 행 단위로 나뉘고, 저장하면 한 표로 돌아온다', async ({ page }) => {
    /* 예전에는 표가 통째로 밀리거나 밀 수 없으면 종이가 늘어났다.
       워드·한글처럼 들어가는 행까지만 남기고 나머지를 다음 쪽으로 흘려야 한다. */
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const rows = Array.from({ length: 40 }, (_, i) => `<tr><td><p>행 ${i + 1}</p></td><td><p>값 ${i + 1}</p></td></tr>`).join('')
      const dt = new DataTransfer()
      dt.setData('text/html',
        '<p>표 앞</p><table data-repeat-header="1"><tbody>' +
        '<tr><th><p>이름</p></th><th><p>값</p></th></tr>' + rows +
        '</tbody></table><p>표 뒤</p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)

    const state = await page.evaluate(() => ({
      pages: document.querySelectorAll('.jan-page-node').length,
      perPage: [...document.querySelectorAll('.jan-page-node')].map((p) => p.querySelectorAll('table tr').length),
      grown: document.querySelectorAll('.jan-page-node[data-jan-grow]').length,
      continued: document.querySelectorAll('.tableWrapper[data-cont]').length,
      repeated: document.querySelectorAll('.ProseMirror tr[data-repeated]').length,
    }))
    expect(state.pages).toBeGreaterThan(1)
    expect(state.perPage.filter((n) => n > 0).length).toBeGreaterThan(1) // 표가 두 쪽에 걸쳐 있다
    expect(state.continued).toBe(1)   // 뒤 조각에 "이어짐" 표시
    expect(state.repeated).toBe(1)    // 제목 행이 복제돼 얹혔다

    // 저장본은 한 표로 합쳐진다 (조각이 남으면 문서가 영영 쪼개진다)
    const saved = await savedHtml(page)
    const merged = await page.evaluate((html) => {
      const wrap = document.createElement('div')
      wrap.innerHTML = html
      return {
        tables: wrap.querySelectorAll('table').length,
        rows: wrap.querySelectorAll('tr').length,
        cont: wrap.querySelectorAll('[data-cont]').length,
        repeated: wrap.querySelectorAll('[data-repeated]').length,
      }
    }, saved)
    expect(merged).toEqual({ tables: 1, rows: 41, cont: 0, repeated: 0 })
  })

  test('표를 글자처럼 두거나 옆으로 글이 흐르게 한다 (한글의 글자처럼 취급 · 워드의 텍스트 배치)', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html',
        '<p>앞 문단</p>' +
        '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>' +
        '<p>뒤 문단</p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })

    const wrapState = () => page.evaluate(() => {
      const w = document.querySelector('.ProseMirror .tableWrapper') as HTMLElement
      return { attr: w.getAttribute('data-wrap'), float: getComputedStyle(w).float, display: getComputedStyle(w).display }
    })
    /* 텍스트 배치는 워드처럼 「텍스트 배치 · 표 자리 ▾」 안에 묶여 있다 */
    const use = async (name: RegExp) => {
      const tab = page.getByRole('tab', { name: '표 레이아웃', exact: true })
      if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.dispatchEvent('click')
      await page.waitForTimeout(150)
      const drop = page.locator('.jan-ribbon-split[aria-label^="텍스트 배치"]')
      const item = page.locator('.jan-ribbon-dropdown button').filter({ hasText: name }).first()
      for (let tries = 0; tries < 4 && (await item.count()) === 0; tries += 1) {
        await drop.dispatchEvent('click')
        await page.waitForTimeout(200)
      }
      await item.dispatchEvent('click')
      await page.waitForTimeout(250)
    }

    await use(/왼쪽에 두고 글 흐르기/)
    expect(await wrapState()).toMatchObject({ attr: 'left', float: 'left' })

    await use(/글자처럼 취급/)
    expect(await wrapState()).toMatchObject({ attr: 'inline', display: 'inline-block' })

    await use(/문단 사이 \(감싸지 않음\)/)
    expect(await wrapState()).toMatchObject({ attr: null, float: 'none' })
  })

  test('표를 오른쪽 클릭하면 워드처럼 표 명령이 그 자리에 나온다', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').first().click({ force: true })
    await page.locator('.ProseMirror table td').first().click({ button: 'right', force: true })

    const menu = page.locator('.jan-table-ctx')
    await expect(menu).toBeVisible()
    const labels = await menu.getByRole('menuitem').allInnerTexts()
    for (const name of ['위에 행 삽입', '열 삭제', '셀 병합', '표 전체 선택', '수식 (fx)']) {
      expect(labels.some((l) => l.includes(name))).toBe(true)
    }
    // 눌러 보면 실제로 행이 늘어난다
    await menu.getByRole('menuitem', { name: '위에 행 삽입' }).click()
    await expect(page.locator('.ProseMirror table tr')).toHaveCount(3)
  })

  test('마지막 칸에서 Tab 을 누르면 새 행이 생긴다 (워드와 같다)', async ({ page }) => {
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<table><tbody><tr><th><p>가</p></th><th><p>나</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await waitForReflow(page)
    await page.locator('.ProseMirror table td').last().click({ force: true })
    await page.keyboard.press('Tab')
    await expect(page.locator('.ProseMirror table tr')).toHaveCount(3)
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

  test('한 쪽보다 긴 표는 쪽에 걸쳐 나뉜다 — 종이를 늘리지 않는다', async ({ page }) => {
    /* 예전에는 이 경우 그 쪽만 예외로 늘어났다(표를 쪼갤 수 없었으므로).
       이제는 워드·한글처럼 행 단위로 나뉘므로 종이는 규격을 지킨다. */
    await page.keyboard.type('/표')
    await page.waitForTimeout(600)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+End')
    for (let i = 0; i < 160; i++) await page.keyboard.press('Tab')
    await waitForReflow(page)

    const m = await pageMetrics(page)
    expect(m.count).toBeGreaterThan(1)  // 여러 쪽에 걸친다
    expect(m.grown).toBe(0)             // 종이는 늘어나지 않는다
    for (const p of m.pages) expect(p.overflow).toBeLessThanOrEqual(2)
    // 표가 두 쪽 이상에 실제로 나뉘어 있다
    const tablePages = await page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')].filter((p) => p.querySelector('table')).length)
    expect(tablePages).toBeGreaterThan(1)

    // 표를 지우면 한 쪽으로 돌아온다
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

    await page.getByRole('tab', { name: '자료', exact: true }).click()
    /* 학술 표준 양식은 「학술 양식 › 표준 양식 ▾」 안에 모여 있다 */
    await page.locator('button[aria-label^="학술 표준 양식"] .jan-ribbon-caret').first().click()
    await page.locator('.jan-ribbon-dropdown button.jan-menu-item').filter({ hasText: /APA/ }).first().click()
    await page.waitForTimeout(1500)

    const frames = await page.evaluate(() => (window as unknown as { __raf: number }).__raf)
    expect(frames).toBeLessThan(200) // 폭주하면 1.5초에 수백~수천 회가 된다

    // 그리고 화면이 여전히 즉시 응답해야 한다
    const t0 = Date.now()
    await page.evaluate(() => document.querySelectorAll('.jan-page-node').length)
    expect(Date.now() - t0).toBeLessThan(600)
  })
})
