import { test, expect } from '@playwright/test'

/**
 * 극한 마크업을 밀어 넣고 조판이 견디는지 잰다.
 *
 * 기존 파일을 여는 것이 아니라 HTML 을 편집기에 곧바로 밀어 넣는다(setContent) —
 * 밖에서 붙여넣은 마크업이 우리 스키마를 지나며 무엇을 잃는지, 그 뒤 쪽 나눔이
 * 버티는지가 여기서만 드러나기 때문이다. 재는 것은 셋이다.
 *  ① 다단 안에서 굽은 가장자리를 따라 흐르는 그림 감싸기
 *  ② 큰 분수·행렬과 밖에서 온 MathML
 *  ③ 절대 좌표 개체가 제 문단을 따라가는가
 * 그리고 쪽 경계에서 글이 깨지지 않는가(중첩 인라인·백스페이스·커서).
 */

const 동그라미 = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><circle cx="75" cy="75" r="74" fill="#c33"/></svg>'
)

type Page = import('@playwright/test').Page

async function 열기(page: Page) {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await page.waitForTimeout(300)
  await doc.click()
  return doc
}

/** HTML 을 편집기에 곧바로 밀어 넣고 쪽 나눔이 앉을 때까지 기다린다 */
async function 밀어넣기(page: Page, html: string, ms = 3000) {
  await page.evaluate((h) => {
    const ed = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }).__janEditor
    ed.commands.setContent(h)
  }, html)
  await page.waitForTimeout(ms)
}

async function 단으로(page: Page, n: 2 | 3) {
  await page.getByRole('tab', { name: '레이아웃', exact: true }).click()
  await page.locator('button[aria-label^="다단"] .jan-ribbon-caret').first().click()
  await page.locator('.jan-ribbon-dropdown button').filter({ hasText: n === 2 ? '다단: 둘' : '다단: 셋' }).first().click()
  await page.waitForTimeout(500)
}

const 채움 = (i: number) =>
  `<p>${i}번 문단이다. 쪽을 채우기 위한 글이며 충분히 길어야 여러 줄이 된다. 가나다라마바사아자차카타파하 ABCDEFG HIJKLMN.</p>`

/** 어느 쪽도 글이 아래 여백을 뚫지 않았는가 (늘어나도 되는 쪽은 예외) */
async function 넘친양(page: Page): Promise<number> {
  return page.evaluate(() => {
    let worst = 0
    document.querySelectorAll('[data-jan-page]').forEach((pg) => {
      if (pg.getAttribute('data-jan-grow') === '1') return
      const box = pg.getBoundingClientRect()
      const limit = box.bottom - (parseFloat(getComputedStyle(pg).paddingBottom) || 0)
      pg.childNodes.forEach((n) => {
        if (n.nodeType !== 1) return
        const el = n as HTMLElement
        if (el.classList.contains('ProseMirror-widget')) return
        // 흐름 밖에 놓인 개체(글 앞·뒤 배치)는 여백을 뚫는 것이 아니라 얹히는 것이다
        if (getComputedStyle(el).position === 'absolute') return
        const r = el.getBoundingClientRect()
        if (r.height && r.bottom > limit) worst = Math.max(worst, r.bottom - limit)
      })
    })
    return Math.round(worst)
  })
}

/* ─────────────────────────────────────────────────────────────
 * ① 다단 안에서 쪽이 잘릴 때 그림 감싸기
 * ───────────────────────────────────────────────────────────── */

test('① 2단에서 shape-outside 를 가진 그림이 살아남고 글이 굽은 가장자리를 따라 흐른다', async ({ page }) => {
  await 열기(page)
  await 단으로(page, 2)
  await 밀어넣기(page, `${Array.from({ length: 3 }, (_, i) => 채움(i + 1)).join('')}
<p><img src="${동그라미}" width="150" height="150" style="float:left;shape-outside:circle(50%);shape-margin:6px;"> 감싸기 문단이다. 이 글은 원의 굽은 가장자리를 따라 흘러야 하며 줄마다 시작하는 가로 자리가 달라야 한다. ${'가나다라마바사아자차카타파하 '.repeat(12)}</p>
${Array.from({ length: 22 }, (_, i) => 채움(i + 5)).join('')}`)

  const 잰것 = await page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img') as HTMLImageElement
    const cs = getComputedStyle(img)
    const p = Array.from(document.querySelectorAll('.ProseMirror p')).find((x) => x.textContent?.includes('감싸기 문단')) as HTMLElement
    const r = document.createRange()
    r.selectNodeContents(p)
    // 그림 오른쪽으로 흐르는 줄만 본다 (그림 아래로 내려간 줄은 왼끝으로 돌아온다)
    const 시작 = Array.from(r.getClientRects()).filter((x) => x.height > 2).map((x) => Math.round(x.left))
    const 그림오른끝 = Math.round(img.getBoundingClientRect().right)
    const 감싼줄 = 시작.filter((x) => x < 그림오른끝 + 40 && x > 그림오른끝 - 60)
    return { float: cs.float, shape: cs.shapeOutside, margin: cs.shapeMargin, 시작, 감싼줄, 서로다른시작: new Set(감싼줄).size, 단: getComputedStyle(document.querySelector('[data-jan-page]')!).columnCount }
  })

  expect(잰것.단).toBe('2')
  // 밖에서 온 감싸기 모양이 그대로 남았는가 (예전에는 renderHTML 이 스타일을 새로 짜며 통째로 버렸다)
  expect(잰것.float).toBe('left')
  expect(잰것.shape).toBe('circle(50%)')
  expect(잰것.margin).toBe('6px')
  /* 굽은 가장자리를 따라 흐르면 줄마다 시작하는 x 가 달라진다.
     네모난 상자를 피해 흐르면 모든 줄이 같은 x 에서 시작한다 — 그때 이 값은 1 이다. */
  expect(잰것.서로다른시작).toBeGreaterThanOrEqual(3)
  expect(await 넘친양(page)).toBeLessThan(4)
})

test('① 3단에서 다각형 감싸기가 살아남고, 쪽이 갈려도 글이 사라지지 않는다', async ({ page }) => {
  await 열기(page)
  await 단으로(page, 3)
  const 다각형 = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
  const 앞 = Array.from({ length: 30 }, (_, i) => 채움(i + 1)).join('')
  const 뒤 = Array.from({ length: 30 }, (_, i) => 채움(i + 32)).join('')
  await 밀어넣기(page, `${앞}
<p><img src="${동그라미}" width="120" height="120" style="float:left;shape-outside:${다각형};shape-margin:4px;"> 감싸기 문단이다. 다각형 가장자리를 따라 글이 흘러야 한다. ${'가나다라마바사아자차카타파하 '.repeat(10)}</p>
${뒤}`, 3500)

  const 잰것 = await page.evaluate(() => {
    const img = document.querySelector('.ProseMirror img') as HTMLImageElement
    const p = Array.from(document.querySelectorAll('.ProseMirror p')).find((x) => x.textContent?.includes('감싸기 문단')) as HTMLElement
    const r = document.createRange()
    r.selectNodeContents(p)
    const 오른끝 = Math.round(img.getBoundingClientRect().right)
    const 감싼줄 = Array.from(r.getClientRects()).filter((x) => x.height > 2).map((x) => Math.round(x.left)).filter((x) => x < 오른끝 + 40 && x > 오른끝 - 60)
    return {
      단: getComputedStyle(document.querySelector('[data-jan-page]')!).columnCount,
      shape: getComputedStyle(img).shapeOutside,
      서로다른시작: new Set(감싼줄).size,
      쪽수: document.querySelectorAll('[data-jan-page]').length,
      글자수: (document.querySelector('.ProseMirror') as HTMLElement).textContent?.length || 0,
    }
  })
  expect(잰것.단).toBe('3')
  expect(잰것.shape).toContain('polygon')
  expect(잰것.서로다른시작).toBeGreaterThanOrEqual(3)
  expect(잰것.쪽수).toBeGreaterThan(1)
  // 앞·뒤 쪽의 글이 사라지지 않았는가 — 채움 문단이 하나도 빠지면 안 된다
  const 남은번호 = await page.evaluate(() => {
    const t = (document.querySelector('.ProseMirror') as HTMLElement).textContent || ''
    return [1, 30, 32, 61].map((n) => t.includes(`${n}번 문단이다`))
  })
  expect(남은번호).toEqual([true, true, true, true])
  expect(await 넘친양(page)).toBeLessThan(4)
})

/* ─────────────────────────────────────────────────────────────
 * ② 인라인 수식과 줄 높이
 * ───────────────────────────────────────────────────────────── */

test('② 큰 분수·행렬이 든 줄에서 윗줄·아랫줄 글자가 겹치지 않는다', async ({ page }) => {
  await 열기(page)
  await page.evaluate(() => {
    const ed = (window as unknown as { __janEditor: { commands: Record<string, (...a: unknown[]) => boolean>; state: { doc: { descendants: (f: (n: { type: { name: string }; textContent: string; nodeSize: number }, p: number) => void) => void } } } }).__janEditor
    ed.commands.setContent('<p>기준 문단이다. 가나다라마바사아자차카타파하 ABCDEFG.</p><p>수식 문단 앞글 </p><p>뒤 문단이다. 가나다라마바사아자차카타파하.</p>')
    let at = -1
    ed.state.doc.descendants((n, p) => { if (at < 0 && n.type.name === 'paragraph' && n.textContent.startsWith('수식 문단')) at = p + n.nodeSize - 1 })
    ed.commands.focus(at)
    ed.commands.setMath('\\frac{\\sum_{i=1}^{n} x_i^2}{\\sqrt{\\alpha+\\beta}}')
    ed.commands.insertContent(' 사이글 ')
    ed.commands.setMath('\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}')
    ed.commands.insertContent(` 뒷글이 이어진다. ${'가나다라마바사아자차카타파하 '.repeat(8)}`)
  })
  await page.waitForTimeout(2500)

  const 잰것 = await page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll('.ProseMirror p')) as HTMLElement[]
    const 상자 = ps.map((p) => { const r = p.getBoundingClientRect(); return { 글: (p.textContent || '').slice(0, 10), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) } })
    // 문단끼리 겹치는가
    let 문단겹침 = 0
    for (let i = 1; i < 상자.length; i += 1) 문단겹침 = Math.max(문단겹침, +(상자[i - 1].bottom - 상자[i].top).toFixed(1))
    /* 수식 문단의 「글자」끼리 겹치는가.
       수식 속살(KaTeX 가 만든 상자들)은 서로 겹치는 것이 정상이다 — 행렬의 큰 괄호는
       세 줄을 다 덮는다. 그러니 수식 안쪽은 빼고 **본문 글자만** 견준다. */
    const 수식문단 = ps.find((p) => p.textContent?.includes('사이글'))!
    const 글자상자: DOMRect[] = []
    const walker = document.createTreeWalker(수식문단, NodeFilter.SHOW_TEXT)
    let t: globalThis.Node | null
    while ((t = walker.nextNode())) {
      if ((t.parentElement as HTMLElement)?.closest('.jan-math-inline')) continue
      const rr = document.createRange()
      rr.selectNodeContents(t)
      Array.from(rr.getClientRects()).forEach((x) => { if (x.height > 2 && x.width > 0) 글자상자.push(x) })
    }
    let 글자겹침 = 0
    for (let i = 0; i < 글자상자.length; i += 1) {
      for (let j = i + 1; j < 글자상자.length; j += 1) {
        const a = 글자상자[i]; const b = 글자상자[j]
        const 세로 = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        const 가로 = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        if (세로 > 2 && 가로 > 2) 글자겹침 = Math.max(글자겹침, Math.round(Math.min(세로, 가로)))
      }
    }
    const 수식 = Array.from(document.querySelectorAll('.ProseMirror .jan-math-inline')).map((e) => Math.round(e.getBoundingClientRect().height))
    return { 상자, 문단겹침, 글자겹침, 수식높이: 수식, 문단높이: Math.round(수식문단.getBoundingClientRect().height) }
  })

  // 큰 수식이 줄 높이를 밀어내도 문단끼리 겹쳐서는 안 된다
  expect(잰것.문단겹침).toBeLessThanOrEqual(0)
  // 수식이 줄 밖으로 밀려나 글자에 포개지지도 않아야 한다
  expect(잰것.글자겹침).toBe(0)
  // 행렬이 실제로 크게 그려졌는지 (작게 그려졌다면 시험이 헛것이다)
  expect(Math.max(...잰것.수식높이)).toBeGreaterThan(40)
  expect(await 넘친양(page)).toBeLessThan(4)
})

test('② 수식이 저장본과 인쇄본에 알맹이째 남는다', async ({ page }) => {
  await 열기(page)
  await page.evaluate(() => {
    const ed = (window as unknown as { __janEditor: { commands: Record<string, (...a: unknown[]) => boolean> } }).__janEditor
    ed.commands.setContent('<p>앞글 </p>')
    ed.commands.focus('end')
    ed.commands.setMath('\\frac{a+b}{c+d}')
  })
  await page.waitForTimeout(900)

  const 잰것 = await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: unknown }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    const pe = await import('/v2/src/lib/pdfExport.ts')
    const saved = pd.getSavableHtml(w.__janEditor as never)
    const printed = pe.buildPrintHtml(saved, '시험')
    return {
      저장길이: saved.length,
      저장에수식: /<math/.test(saved),
      저장에latex: saved.includes('\\frac{a+b}{c+d}'),
      인쇄에수식: /<math/.test(printed),
      /* 예전에는 그림 규격에 없는 innerHTML 을 적어 놓아, 저장본에는 2KB 짜리
         innerhtml="…" 속성만 남고 알맹이가 하나도 없었다 — 인쇄·PDF 가 텅 비었다 */
      인쇄에깡통속성: /innerhtml=/i.test(printed),
      // 살균기가 <annotation> 을 벗기며 원문 LaTeX 를 날 글자로 남기면 인쇄본에 그것이 찍힌다
      인쇄에날LaTeX: /<math[^>]*>[\s\S]*?\\frac\{a\+b\}/.test(printed),
    }
  })
  expect(잰것.저장에수식).toBe(true)
  expect(잰것.저장에latex).toBe(true)      // 다시 열 때 KaTeX 로 되살릴 원문
  expect(잰것.인쇄에수식).toBe(true)
  expect(잰것.인쇄에깡통속성).toBe(false)
  expect(잰것.인쇄에날LaTeX).toBe(false)
  expect(잰것.저장길이).toBeLessThan(1200) // 깡통 속성이 있으면 2KB 를 훌쩍 넘는다

  // 저장본을 도로 실어도 수식이 그대로 살아난다
  await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    w.__janEditor.commands.setContent(pd.getSavableHtml(w.__janEditor as never))
  })
  await page.waitForTimeout(900)
  const 되싣기 = await page.evaluate(() => ({
    latex: Array.from(document.querySelectorAll('.ProseMirror [data-math]')).map((e) => (e as HTMLElement).dataset.latex),
    분수: document.querySelectorAll('.ProseMirror .katex .mfrac').length,
  }))
  expect(되싣기.latex).toEqual(['\\frac{a+b}{c+d}'])
  expect(되싣기.분수).toBe(1)
})

test('② 밖에서 붙여넣은 MathML 이 글자로 뭉개지지 않는다', async ({ page }) => {
  await 열기(page)
  const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mrow><mi>c</mi><mo>+</mo><mi>d</mi></mrow></mfrac></math>'
  await 밀어넣기(page, `<p>앞글 ${mathml} 뒷글</p>`, 1500)

  const 잰것 = await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: unknown }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    const saved = pd.getSavableHtml(w.__janEditor as never)
    return {
      화면분수: document.querySelectorAll('.ProseMirror [data-math] math mfrac').length,
      저장에분수: /<mfrac/.test(saved),
    }
  })
  /* 예전에는 <math> 를 아무도 맡지 않아 속의 글자만 주워 담았다 —
     a+b 분의 c+d 가 「a+bc+d」 라는 틀린 글이 되어 조용히 남았다 */
  expect(잰것.화면분수).toBe(1)
  expect(잰것.저장에분수).toBe(true)

  await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    w.__janEditor.commands.setContent(pd.getSavableHtml(w.__janEditor as never))
  })
  await page.waitForTimeout(800)
  expect(await page.locator('.ProseMirror [data-math] math mfrac').count()).toBe(1)
})

/* ─────────────────────────────────────────────────────────────
 * ③ 절대 좌표 개체의 쪽 귀속
 * ───────────────────────────────────────────────────────────── */

for (const 배치 of ['front', 'behind'] as const) {
  test(`③ 「글 ${배치 === 'front' ? '앞' : '뒤'}」 개체가 앞 문단이 길어져도 제 문단을 따라간다`, async ({ page }) => {
    await 열기(page)
    await 밀어넣기(page, `${Array.from({ length: 10 }, (_, i) => 채움(i + 1)).join('')}
<p>닻 문단이다. 이 문단에 개체가 붙어 있다. <img src="${동그라미}" width="150" height="150" data-wrap="${배치}"></p>
${Array.from({ length: 24 }, (_, i) => 채움(i + 12)).join('')}`)

    const 재기 = () => page.evaluate(() => {
      const pages = Array.from(document.querySelectorAll('[data-jan-page]')) as HTMLElement[]
      const img = document.querySelector('.ProseMirror img') as HTMLImageElement
      const 닻 = Array.from(document.querySelectorAll('.ProseMirror p')).find((p) => p.textContent?.includes('닻 문단')) || null
      const ir = img?.getBoundingClientRect()
      const gi = pages.findIndex((p) => p.contains(img))
      const pr = gi >= 0 ? pages[gi].getBoundingClientRect() : null
      return {
        쪽수: pages.length,
        그림쪽: gi,
        닻쪽: 닻 ? pages.findIndex((p) => p.contains(닻)) : -1,
        보임: !!ir && ir.width > 0 && ir.height > 0,
        // overflow:clip 이라 종이 밖으로 나가면 그만큼 보이지 않는다
        잘림: ir && pr ? Math.max(0, Math.round(ir.bottom - pr.bottom)) : 0,
        절대: img ? getComputedStyle(img).position : null,
      }
    })

    const 처음 = await 재기()
    expect(처음.절대).toBe('absolute')   // 「글 앞·뒤」 는 흐름 밖에 얹힌다
    expect(처음.그림쪽).toBe(처음.닻쪽)
    expect(처음.보임).toBe(true)
    expect(처음.잘림).toBe(0)

    // 앞 문단에 글을 잔뜩 보태 쪽을 두 번 민다
    for (const 몫 of [200, 200]) {
      await page.evaluate((n) => {
        const ed = (window as unknown as { __janEditor: { commands: { insertContentAt: (p: number, c: string) => boolean } } }).__janEditor
        ed.commands.insertContentAt(2, '앞에 보태는 글이다. '.repeat(n))
      }, 몫)
      await page.waitForTimeout(3000)
      const 뒤 = await 재기()
      /* 개체가 1쪽 그 자리에 유령처럼 남으면 안 된다 — 제 문단을 따라가야 한다 */
      expect(뒤.그림쪽).toBe(뒤.닻쪽)
      expect(뒤.보임).toBe(true)
      expect(뒤.잘림).toBe(0)
      expect(뒤.쪽수).toBeGreaterThan(처음.쪽수 - 1)
    }
    expect(await 넘친양(page)).toBeLessThan(4)
  })
}

test('③ 인쇄 조판(paged.js)에서도 개체가 제 문단과 같은 쪽에 나온다', async ({ page }) => {
  await 열기(page)
  await 밀어넣기(page, `${Array.from({ length: 28 }, (_, i) => 채움(i + 1)).join('')}
<p>닻 문단이다. 이 문단에 개체가 붙어 있다. <img src="${동그라미}" width="150" height="150" data-wrap="front"></p>
${Array.from({ length: 20 }, (_, i) => 채움(i + 30)).join('')}`)

  const 인쇄본 = await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: unknown }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    const pe = await import('/v2/src/lib/pdfExport.ts')
    return pe.buildPrintHtml(pd.getSavableHtml(w.__janEditor as never), '시험', undefined, { pagedSource: await pe.getPagedSource() })
  })
  const 종이 = await page.context().newPage()
  await 종이.setContent(인쇄본, { waitUntil: 'load' })
  await 종이.waitForTimeout(6000)
  const 잰것 = await 종이.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('.pagedjs_page')) as HTMLElement[]
    const img = document.querySelector('img.jan-img-el')
    const 닻 = Array.from(document.querySelectorAll('p')).find((p) => p.textContent?.includes('닻 문단')) || null
    const gi = img ? boxes.findIndex((b) => b.contains(img)) : -1
    const ir = img?.getBoundingClientRect()
    const br = gi >= 0 ? boxes[gi].getBoundingClientRect() : null
    return {
      쪽수: boxes.length,
      그림있음: !!img,
      그림쪽: gi,
      닻쪽: 닻 ? boxes.findIndex((b) => b.contains(닻)) : -1,
      제쪽안: !!ir && !!br && ir.top >= br.top - 1 && ir.bottom <= br.bottom + 1,
    }
  })
  await 종이.close()
  expect(잰것.쪽수).toBeGreaterThan(1)
  expect(잰것.그림있음).toBe(true)
  expect(잰것.그림쪽).toBe(잰것.닻쪽)
  expect(잰것.제쪽안).toBe(true)
})

/* ─────────────────────────────────────────────────────────────
 * 쪽 경계에서 글이 깨지지 않는가
 * ───────────────────────────────────────────────────────────── */

test('중첩 인라인이 든 문단을 쪽 경계에서 쪼개도 마크가 늘거나 줄지 않는다', async ({ page }) => {
  await 열기(page)
  const 조각: string[] = []
  for (let i = 1; i <= 120; i += 1) {
    조각.push(`<strong><em><u><a href="https://example.com/${i}">겹침${i}</a></u></em></strong> 사이글자${i} 채움채움채움 `)
  }
  await 밀어넣기(page, `<p>머리 문단</p><p>${조각.join('')}</p><p>꼬리 문단</p>`)

  const 쪼갬 = await page.evaluate(() => {
    const cont = Array.from(document.querySelectorAll('.ProseMirror [data-jan-cont]')) as HTMLElement[]
    const 토막 = Array.from(document.querySelectorAll('.ProseMirror p')).filter((p) => p.textContent?.includes('겹침'))
    return {
      조각수: cont.length,
      토막수: 토막.length,
      // 쪼개진 조각에도 열림·닫힘이 온전한가 — href 없는 <a> 가 하나라도 있으면 깨진 것이다
      href없는a: 토막.reduce((n, p) => n + p.querySelectorAll('a:not([href])').length, 0),
    }
  })
  expect(쪼갬.조각수).toBeGreaterThan(0) // 정말 경계에 걸렸는가 (안 걸리면 이 시험은 헛것이다)
  expect(쪼갬.토막수).toBeGreaterThan(1)
  expect(쪼갬.href없는a).toBe(0)

  // 저장하면 원래 한 문단으로 정확히 합쳐진다
  const 왕복 = await page.evaluate(async () => {
    const w = window as unknown as { __janEditor: unknown }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    const saved = pd.getSavableHtml(w.__janEditor as never)
    const root = new DOMParser().parseFromString(`<div id=r>${saved}</div>`, 'text/html').getElementById('r')!
    const p = Array.from(root.querySelectorAll('p')).find((x) => x.textContent?.includes('겹침1 '))!
    return {
      문단수: root.querySelectorAll('p').length,
      strong: p.querySelectorAll('strong').length,
      em: p.querySelectorAll('em').length,
      u: p.querySelectorAll('u').length,
      a: p.querySelectorAll('a[href]').length,
      href없는a: p.querySelectorAll('a:not([href])').length,
      끝: (p.textContent || '').slice(-20),
      마지막주소: p.querySelector('a:last-of-type')?.getAttribute('href'),
    }
  })
  expect(왕복.문단수).toBe(3)          // 머리 · 긴 문단 하나 · 꼬리
  expect(왕복.strong).toBe(120)
  expect(왕복.em).toBe(120)
  expect(왕복.u).toBe(120)
  expect(왕복.a).toBe(120)
  expect(왕복.href없는a).toBe(0)
  expect(왕복.끝.endsWith('사이글자120 채움채움채움')).toBe(true) // 꼬리 글자가 하나도 안 빠졌다
  expect(왕복.마지막주소).toBe('https://example.com/120')
})

test('이어짐 조각 맨 앞에서 백스페이스를 눌러도 한 문단이 두 문단으로 갈라지지 않는다', async ({ page }) => {
  await 열기(page)
  const 긴 = '가나다라마바사아자차카타파하 이것은 한 쪽보다 긴 문단이며 반드시 쪽 경계에서 쪼개진다. '.repeat(60)
  await 밀어넣기(page, `<p>머리 문단</p><p>${긴}</p><p>꼬리 문단</p>`)

  const 상태 = () => page.evaluate(async () => {
    const w = window as unknown as { __janEditor: { state: { doc: { textBetween: (a: number, b: number, s?: string) => string; content: { size: number } } } } }
    const pd = await import('/v2/src/extensions/PageDocument.ts')
    const saved = pd.getSavableHtml(w.__janEditor as never)
    const root = new DOMParser().parseFromString(`<div id=r>${saved}</div>`, 'text/html').getElementById('r')!
    return {
      조각: document.querySelectorAll('.ProseMirror [data-jan-cont]').length,
      저장문단: root.querySelectorAll('p').length,
      글자수: w.__janEditor.state.doc.textBetween(0, w.__janEditor.state.doc.content.size, '\n').length,
    }
  })
  const 전 = await 상태()
  expect(전.조각).toBeGreaterThan(0)   // 정말 쪼개졌는가
  expect(전.저장문단).toBe(3)

  await page.evaluate(() => {
    const c = document.querySelector('.ProseMirror [data-jan-cont]') as HTMLElement
    const w = window as unknown as { __janEditor: { view: { posAtDOM: (n: Node, o: number) => number }; commands: { focus: (p: number) => boolean } } }
    w.__janEditor.commands.focus(w.__janEditor.view.posAtDOM(c, 0))
  })
  await page.waitForTimeout(400)
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(2500)
  const 후 = await 상태()

  /* 예전에는 여기서 아무 일도 안 일어난 것처럼 보였다 — 글자도 안 지워지고 커서도 안 움직였다.
     그런데 속으로는 이어짐 표시가 지워져 **한 문단이 영영 두 문단으로 갈라졌다**(저장 문단 3→4). */
  expect(후.저장문단).toBe(3)
  // 원래 한 문단이었으니 백스페이스는 워드처럼 「앞 글자 하나 지우기」 여야 한다
  expect(전.글자수 - 후.글자수).toBe(1)
})

test('쪽 경계를 넘나드는 동안 커서가 종이 안에 머문다', async ({ page }) => {
  await 열기(page)
  await 밀어넣기(page, Array.from({ length: 30 }, (_, i) => 채움(i + 1)).join(''))
  await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('[data-jan-page]')) as HTMLElement[]
    const w = window as unknown as { __janEditor: { view: { posAtDOM: (n: Node, o: number) => number }; commands: { focus: (p: number) => boolean } } }
    const last = pages[0].lastElementChild as HTMLElement
    w.__janEditor.commands.focus(w.__janEditor.view.posAtDOM(last, 0))
  })
  await page.waitForTimeout(300)

  const 재기 = () => page.evaluate(() => {
    const w = window as unknown as { __janEditor: { state: { selection: { from: number } }; view: { coordsAtPos: (p: number) => { top: number; bottom: number } } } }
    const from = w.__janEditor.state.selection.from
    let c: { top: number; bottom: number } | null
    try { c = w.__janEditor.view.coordsAtPos(from) } catch { c = null }
    const pages = Array.from(document.querySelectorAll('[data-jan-page]')) as HTMLElement[]
    let 안쪽 = false
    if (c) {
      for (const p of pages) {
        const r = p.getBoundingClientRect(); const s = getComputedStyle(p)
        if (c.top >= r.top + parseFloat(s.paddingTop) - 6 && c.bottom <= r.bottom - parseFloat(s.paddingBottom) + 6) { 안쪽 = true; break }
      }
    }
    return { from, 안쪽, 있음: !!c }
  })

  /* 쪽과 쪽 사이에는 32px 짜리 틈이 있다. 커서가 그 틈으로 숨으면 글이 보이지 않는 곳에 쌓인다. */
  const 자취: number[] = []
  for (const 키 of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'End', 'ArrowDown', 'Home', 'ArrowUp', 'ArrowUp']) {
    await page.keyboard.press(키)
    await page.waitForTimeout(250)
    const r = await 재기()
    expect(r.있음, `${키} 뒤 커서 좌표를 못 읽는다`).toBe(true)
    expect(r.안쪽, `${키} 뒤 커서가 종이 밖(쪽 사이 틈)에 있다`).toBe(true)
    자취.push(r.from)
  }
  expect(new Set(자취).size).toBeGreaterThan(1) // 정말 움직였는가

  // 경계에서 이어 치기 — 넘어간 글자 바로 뒤에 커서가 따라와야 한다
  await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('[data-jan-page]')) as HTMLElement[]
    const w = window as unknown as { __janEditor: { view: { posAtDOM: (n: Node, o: number) => number }; commands: { focus: (p: number) => boolean } } }
    const last = pages[0].lastElementChild as HTMLElement
    w.__janEditor.commands.focus(w.__janEditor.view.posAtDOM(last, last.childNodes.length))
  })
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.type('가나다라마바사아자차')
    await page.waitForTimeout(700)
    const r = await 재기()
    expect(r.안쪽, `${i + 1}번째 타자 뒤 커서가 종이 밖에 있다`).toBe(true)
  }
  await page.keyboard.type('끝')
  await page.waitForTimeout(900)
  const 앞글자 = await page.evaluate(() => {
    const w = window as unknown as { __janEditor: { state: { selection: { from: number }; doc: { textBetween: (a: number, b: number) => string } } } }
    const f = w.__janEditor.state.selection.from
    return w.__janEditor.state.doc.textBetween(Math.max(0, f - 1), f)
  })
  expect(앞글자).toBe('끝') // 커서가 문서 맨 앞으로 튕기지 않았다
  expect(await 넘친양(page)).toBeLessThan(4)
})
