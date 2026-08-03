import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * 이름 있는 스타일과 상속 — 워드 「기준 스타일(based on)」 자리.
 *
 * 여기서 지키려는 것은 하나다: **문단에는 이름표만 붙고, 서식 값은 스타일 정의 한 곳에만 산다.**
 * 그래야 정의를 고칠 때 그 표를 단 글이 모두 함께 바뀐다.
 * 예전 스타일 갤러리는 그 자리에서 마크를 복사해 두고 끝나, 되돌아볼 연결이 없었다.
 *
 * 실물로 재는 것만 믿는다 — 「코드에 있으니 된다」 가 이 저장소에서 여러 번 틀렸다.
 * 그래서 DOM 속성이 아니라 getComputedStyle 로 화면에 실제로 나타난 값을 잰다.
 */

const 명조 = /Noto Serif KR|Nanum Myeongjo|Batang/
const 고정폭 = /D2Coding|Consolas|Noto Sans Mono/

type Page = import('@playwright/test').Page

async function 문서열기(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('jan-v2-role-onboarded', '1') })
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  return editor
}

/** 글을 치고 「다 들어갔다」 를 확인한다 — 확인 없이 나아가면 저장본이 반만 담긴다 */
async function 타자(page: Page, 글: string) {
  await page.keyboard.type(글)
  await expect(page.locator('.ProseMirror').first()).toContainText(글)
}

/** 스타일 창을 리본에서 연다 (창은 덮개가 아니라 옆에 뜬다 — 문서는 그대로 만질 수 있다) */
async function 스타일창(page: Page) {
  await page.locator('.jan-ribbon-tab', { hasText: /^서식$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label^="스타일 창"]').first().click()
  const dlg = page.locator('.jan-stylepanel')
  await expect(dlg).toBeVisible()
  return dlg
}

/** pt 를 화면 px 로 — 브라우저가 소수점을 반올림하므로 값으로 견준다 */
const px = (pt: number) => (pt * 96) / 72

/** 스타일 창에서 이름으로 하나 고른다 */
async function 스타일고르기(dlg: ReturnType<Page['locator']>, 이름: string) {
  await dlg.locator('.jan-stylepanel-list > button').filter({ hasText: 이름 }).first().click()
}

/** 문단 하나의 화면 값을 잰다 (DOM 속성이 아니라 실제로 그려진 값) */
async function 잰값(page: Page, n = 0) {
  return page.evaluate((i) => {
    const p = document.querySelectorAll('.ProseMirror p')[i] as HTMLElement
    if (!p) return null
    const cs = getComputedStyle(p)
    return {
      표: p.getAttribute('data-jan-style'),
      글: (p.textContent || '').trim(),
      글꼴: cs.fontFamily,
      크기: cs.fontSize,
      굵기: cs.fontWeight,
      들여: cs.marginLeft,
      줄: cs.lineHeight,
    }
  }, n)
}

test.describe('이름 있는 스타일', () => {
  test.use({ viewport: { width: 1500, height: 940 } })

  test('스타일을 입히면 문단에 이름표만 붙는다 — 서식 값이 문단에 박히지 않는다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '제목 줄입니다')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await dlg.locator('.jan-modal-close').click()

    const 값 = await 잰값(page)
    expect(값?.표).toBe('head1')
    // 이름표만 붙는다 — 문단에 인라인 서식이 복사되면 정의를 고쳐도 안 따라온다
    const html = await page.locator('.ProseMirror').first().innerHTML()
    expect(html).toContain('data-jan-style="head1"')
    expect(html).not.toContain('font-size: 17pt')
    // 그런데도 화면에는 스타일 값이 나타난다 (제목1 이 스스로 정한 17pt)
    expect(parseFloat(값!.크기)).toBeCloseTo(px(17), 1)
    expect(값?.굵기).toBe('700') // 「제목」 에서 물려받은 굵게
  })

  test('기준 스타일을 고치면 그 표를 단 글이 함께 바뀐다 — 문서는 건드리지 않는다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '제목 줄입니다')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()

    const 전 = await 잰값(page)
    const 문서전 = await page.evaluate(() => (window as unknown as { __janEditor: { getHTML: () => string } }).__janEditor.getHTML())

    // 부모(「제목」)의 글꼴을 명조로 — 자식(제목1)에는 손대지 않는다
    await 스타일고르기(dlg, '제목')
    await dlg.locator('select[aria-label="스타일 글꼴"]').selectOption('serif')
    await page.waitForTimeout(200)

    const 후 = await 잰값(page)
    expect(전?.글꼴).not.toMatch(명조)
    expect(후?.글꼴).toMatch(명조)           // 부모를 고쳤더니 자식이 따라왔다
    expect(후?.크기).toBe(전?.크기)          // 제 것(17pt)은 그대로

    // 문서는 한 글자도 바뀌지 않았다 — 바뀐 것은 스타일 정의뿐이다
    const 문서후 = await page.evaluate(() => (window as unknown as { __janEditor: { getHTML: () => string } }).__janEditor.getHTML())
    expect(문서후).toBe(문서전)
  })

  test('자식이 스스로 정한 값은 부모를 고쳐도 지켜진다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '제목 줄입니다')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()

    // 부모 「제목」 의 크기를 40pt 로 — 제목1 은 제 크기 17pt 를 정해 두었다
    await 스타일고르기(dlg, '제목')
    await dlg.locator('input[aria-label="스타일 글자 크기"]').fill('40')
    await page.waitForTimeout(200)
    expect(parseFloat((await 잰값(page))!.크기)).toBeCloseTo(px(17), 1)

    // 제목1 이 제 크기를 버리면(물려받기) 그때는 부모 값이 내려온다
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '글자 크기 물려받기' }).click()
    await page.waitForTimeout(200)
    expect(parseFloat((await 잰값(page))!.크기)).toBeCloseTo(px(40), 1)
  })

  test('여러 대를 잇는다 — 바탕글 → 제목 → 제목1 → 제목2', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '세 대 아래 문단')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목2')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()

    // 맨 위 뿌리(바탕글)의 글꼴을 고정폭으로 — 세 대를 건너 내려와야 한다
    await 스타일고르기(dlg, '바탕글')
    await dlg.locator('select[aria-label="스타일 글꼴"]').selectOption('mono')
    await page.waitForTimeout(200)

    const 값 = await 잰값(page)
    expect(값?.표).toBe('head2')
    expect(값?.글꼴).toMatch(고정폭)                 // 할아버지의 할아버지에서 내려왔다
    expect(parseFloat(값!.크기)).toBeCloseTo(px(14), 1)     // 제목2 가 스스로 정한 14pt
    expect(값?.굵기).toBe('700')                     // 「제목」 에서
  })

  test('고리는 못 만든다 — 제 자손을 기준으로 고를 수 없다', async ({ page }) => {
    await 문서열기(page)
    const dlg = await 스타일창(page)

    await 스타일고르기(dlg, '제목1')
    const 고를수있는것 = await dlg.locator('select[aria-label="기준 스타일"] option').allInnerTexts()
    expect(고를수있는것).toContain('바탕글')
    expect(고를수있는것).not.toContain('제목2') // 제 자식
    expect(고를수있는것).not.toContain('제목3') // 제 손자
    expect(고를수있는것).not.toContain('제목1') // 자기 자신
  })

  test('직접 서식은 스타일을 이긴다 — 워드·한글과 같은 차례', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '여기는 직접 고친다')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await dlg.locator('.jan-modal-close').click()

    // 문단 전체를 골라 줄 간격을 직접 준다 (문단 인라인 style)
    await page.locator('.ProseMirror').first().click()
    await page.evaluate(() => {
      const w = window as unknown as { __janEditor: { commands: { setParagraphLineHeight: (v: string) => void } } }
      w.__janEditor.commands.setParagraphLineHeight('3.5')
    })
    await page.waitForTimeout(200)

    // 스타일이 줄 간격을 정해도 직접 서식이 이겨야 한다
    await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.locator('input[aria-label="스타일 줄 간격"]').fill('1.1')
    await page.waitForTimeout(200)
    await dlg.locator('.jan-modal-close').click()

    const 값 = await 잰값(page)
    // 스타일은 붙어 있어야 한다 — 안 붙었으면 이 시험은 아무것도 지키지 않는다
    expect(값?.표).toBe('head1')
    expect(parseFloat(값!.크기)).toBeCloseTo(px(17), 1) // 스타일이 정한 크기는 그대로 나타나고
    const 크기 = parseFloat(값!.크기)
    expect(parseFloat(값!.줄)).toBeCloseTo(크기 * 3.5, 0) // 겹치는 줄 간격만 직접 준 3.5 가 이긴다
  })

  test('저장하고 다시 열어도 이름표와 정의가 살아남는다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '살아남아야 하는 제목')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    // 부모를 명조로 고쳐 둔다 — 정의가 살아남는지 보려면 기본값과 달라야 한다
    await 스타일고르기(dlg, '제목')
    await dlg.locator('select[aria-label="스타일 글꼴"]').selectOption('serif')
    await page.waitForTimeout(400)
    await dlg.locator('.jan-modal-close').click()

    // 저장 경로가 실제로 쓰는 HTML — 여기서 이름표가 벗겨지면 다 헛일이다
    const 저장본 = await page.evaluate(async () => {
      const m = await import('/v2/src/extensions/PageDocument.ts')
      const w = window as unknown as { __janEditor: unknown }
      return (m as { getSavableHtml: (e: unknown) => string }).getSavableHtml(w.__janEditor)
    }).catch(() => null)
    if (저장본) expect(저장본).toContain('data-jan-style="head1"')

    const 전 = await 잰값(page)
    expect(전?.글꼴).toMatch(명조)

    /* 진짜 왕복 — 새로 고침하면 저장된 HTML 과 쪽 설정을 다시 읽어 온다 */
    await page.waitForTimeout(1200) // 자동 저장이 앉을 틈
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(800)

    const 후 = await 잰값(page)
    expect(후?.글).toBe('살아남아야 하는 제목')
    expect(후?.표).toBe('head1')          // 이름표가 살아남았다
    expect(후?.글꼴).toMatch(명조)         // 고쳐 둔 정의도 살아남았다
    expect(후?.크기).toBe(전?.크기)
  })

  test('새 스타일을 기준을 골라 만든다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '내가 만든 스타일')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '새 스타일 (이것을 기준으로)' }).click()
    await dlg.locator('input[aria-label="스타일 이름"]').fill('내 강조 제목')
    await dlg.locator('input[aria-label="스타일 글자 크기"]').fill('9')
    await page.waitForTimeout(200)
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await page.waitForTimeout(200)

    const 값 = await 잰값(page)
    expect(parseFloat(값!.크기)).toBeCloseTo(px(9), 1) // 제 크기
    expect(값?.굵기).toBe('700')                 // 「제목」 에서 두 대 건너 내려온 굵게

    // 목록에도 대를 이어 나온다
    await expect(dlg.locator('.jan-stylepanel-list > button').filter({ hasText: '내 강조 제목' })).toBeVisible()
  })

  test('글자 스타일은 문단이 아니라 고른 낱말에만 붙고, 그것도 상속한다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '앞말 가운데말 뒷말')

    // 「가운데말」 만 고른다
    await page.keyboard.press('Home')
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Shift+ArrowRight')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '참조(글자)')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await page.waitForTimeout(300)

    const 잰것 = await page.evaluate(() => {
      const span = document.querySelector('.ProseMirror [data-jan-cstyle="refC"]') as HTMLElement | null
      const p = document.querySelector('.ProseMirror p') as HTMLElement
      if (!span) return null
      const cs = getComputedStyle(span)
      return { 글: (span.textContent || '').trim(), 크기: cs.fontSize, 굵기: cs.fontWeight, 색: cs.color, 문단크기: getComputedStyle(p).fontSize }
    })
    expect(잰것?.글).toBe('가운데말')
    expect(parseFloat(잰것!.크기)).toBeCloseTo(px(9), 1)   // 참조(글자) 가 스스로 정한 9pt
    expect(잰것?.굵기).toBe('700')                          // 강조(글자) 에서 물려받은 굵게
    expect(잰것?.문단크기).not.toBe(잰것?.크기)             // 문단 전체가 아니라 그 낱말만

    // 부모(강조(글자))의 굵기를 끄면 자식도 따라 풀린다
    await 스타일고르기(dlg, '강조(글자)')
    await dlg.getByRole('button', { name: '스타일 굵게' }).click()
    await page.waitForTimeout(300)
    const 후굵기 = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.ProseMirror [data-jan-cstyle="refC"]') as HTMLElement).fontWeight)
    expect(후굵기).toBe('400')

    // 새로 열어도 낱말에 붙은 표가 살아남는다
    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(700)
    await expect(page.locator('.ProseMirror [data-jan-cstyle="refC"]')).toHaveText('가운데말')
  })

  test('개요 수준 — 스타일이 정한 수준을 문단에서 읽어 낸다, 태그로도 떨어진다', async ({ page }) => {
    await 문서열기(page)

    /* 세 가지를 한 문서에 둔다:
       (1) 스타일만 붙인 그냥 문단 — 태그로는 아무 수준도 아니다
       (2) 예전 방식대로 h1 — 스타일 표가 없다
       (3) h1 인데 「바탕글」 을 붙인 것 — 스타일이 태그를 이겨야 한다 */
    await page.evaluate(() => {
      const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }
      w.__janEditor.commands.setContent(
        '<p data-jan-style="head2">스타일로 만든 제목</p>' +
        '<h1>태그로 만든 제목</h1>' +
        '<h1 data-jan-style="base">제목처럼 보이지만 본문</h1>' +
        '<p>그냥 본문</p>'
      )
    })
    await page.waitForTimeout(300)

    const 수준읽기 = () => page.evaluate(async () => {
      const m = await import('/v2/src/lib/docStyles.ts') as {
        outlineLevelOf: (n: unknown) => number
        outlineLevelOfElement: (el: Element) => number
      }
      const w = window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: unknown) => void) => void } } } }
      const 노드로: Array<{ 글: string; 수준: number }> = []
      w.__janEditor.state.doc.descendants((node) => {
        const n = node as { type: { name: string }; textContent: string }
        if (n.type.name !== 'paragraph' && n.type.name !== 'heading') return
        if (!n.textContent) return
        노드로.push({ 글: n.textContent, 수준: m.outlineLevelOf(node) })
      })
      const 요소로 = [...document.querySelectorAll('.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3')]
        .filter((el) => (el.textContent || '').trim())
        .map((el) => ({ 글: (el.textContent || '').trim(), 수준: m.outlineLevelOfElement(el) }))
      return { 노드로, 요소로 }
    })

    const 처음 = await 수준읽기()
    expect(처음.노드로).toEqual([
      { 글: '스타일로 만든 제목', 수준: 2 },   // 스타일이 정한 수준
      { 글: '태그로 만든 제목', 수준: 1 },     // 스타일이 없으면 태그에서
      { 글: '제목처럼 보이지만 본문', 수준: 0 }, // 스타일이 태그를 이긴다
      { 글: '그냥 본문', 수준: 0 },
    ])
    expect(처음.요소로).toEqual(처음.노드로) // 노드로 읽든 그려진 것으로 읽든 같은 답

    /* 스타일 창에서 「제목」 의 수준을 4 로 바꾸면, 제 것을 정하지 않은 제목1 이 따라온다.
       제목2 는 제 수준 2 를 정해 두었으므로 그대로여야 한다. */
    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await expect(dlg.locator('select[aria-label="스타일 개요 수준"]')).toHaveValue('') // 물려받는 중
    await 스타일고르기(dlg, '제목')
    await dlg.locator('select[aria-label="스타일 개요 수준"]').selectOption('4')
    await page.waitForTimeout(300)

    const 물려받음 = await page.evaluate(async () => {
      const m = await import('/v2/src/lib/docStyles.ts') as { outlineLevelOf: (n: unknown) => number }
      return {
        제목1: m.outlineLevelOf({ type: { name: 'paragraph' }, attrs: { janStyle: 'head1' } }),
        제목2: m.outlineLevelOf({ type: { name: 'paragraph' }, attrs: { janStyle: 'head2' } }),
      }
    })
    expect(물려받음).toEqual({ 제목1: 4, 제목2: 2 })

    /* 저장하고 다시 열어도 살아남아야 한다 — 개요 수준은 눈에 안 보이므로
       화면으로는 못 재고, 정의를 다시 읽어 확인한다 */
    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(800)

    const 다시 = await 수준읽기()
    expect(다시.노드로).toEqual([
      { 글: '스타일로 만든 제목', 수준: 2 },
      { 글: '태그로 만든 제목', 수준: 1 },       // 표가 없는 h1 은 태그 그대로 1 이다
      { 글: '제목처럼 보이지만 본문', 수준: 0 },
      { 글: '그냥 본문', 수준: 0 },
    ])

    const 고친값 = await page.evaluate(async () => {
      const m = await import('/v2/src/lib/docStyles.ts') as { outlineLevelOf: (n: unknown) => number }
      return m.outlineLevelOf({ type: { name: 'paragraph' }, attrs: { janStyle: 'head1' } })
    })
    expect(고친값).toBe(4) // 고쳐 둔 개요 수준이 새로 열어도 살아남았다
  })

  test('개요 수준도 .jan 파일을 건너온다', async ({ page }) => {
    await 문서열기(page)
    await page.evaluate(async () => {
      const jan = await import('/v2/src/lib/janFormat.ts') as { packJan: (d: unknown) => Promise<Blob>; JAN_MIME: string }
      const blob = await jan.packJan({
        title: '남이 보낸 문서',
        html: '<p data-jan-style="mine">내 규칙으로 만든 제목</p>',
        pageSettings: {
          styles: {
            styles: [
              { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { outlineLevel: 0 } },
              { id: 'mine', name: '내 제목', basedOn: 'base', kind: 'paragraph', props: { outlineLevel: 5 } },
            ],
          },
        },
      })
      const file = new File([blob], '남이 보낸 문서.jan', { type: jan.JAN_MIME })
      ;(window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = async () => [{ getFile: async () => file }]
    })
    await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
    await expect(page.locator('.ProseMirror')).toContainText('내 규칙으로 만든 제목', { timeout: 10000 })
    await page.waitForTimeout(600)

    const 수준 = await page.evaluate(async () => {
      const m = await import('/v2/src/lib/docStyles.ts') as { outlineLevelOfElement: (el: Element) => number }
      const el = document.querySelector('.ProseMirror [data-jan-style="mine"]')
      return el ? m.outlineLevelOfElement(el) : null
    })
    expect(수준).toBe(5) // 파일이 정해 온 개요 수준이 그대로 살아났다
  })

  test('내보낸 파일에도 스타일 정의가 함께 실린다 — 이름표만 나가면 밋밋해진다', async ({ page }) => {
    await 문서열기(page)
    await 타자(page, '내보낼 제목')

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await 스타일고르기(dlg, '제목')
    await dlg.locator('select[aria-label="스타일 글꼴"]').selectOption('serif')
    await page.waitForTimeout(300)

    const css = await page.evaluate(async () => {
      const m = await import('/v2/src/lib/docCss.ts')
      return (m as { docExportCss: () => string }).docExportCss()
    })
    expect(css).toContain('[data-jan-style="head1"]')
    expect(css).toMatch(/Noto Serif KR/)   // 고쳐 둔 정의가 그대로 실렸다
    expect(css).toContain('17pt')          // 제목1 이 스스로 정한 크기
  })

  test('.jan 파일로 싸서 열어도 이름표와 고쳐 둔 정의가 그대로 살아난다', async ({ page }) => {
    await 문서열기(page)

    /* 남에게 보낸 파일을 받아 여는 상황 — 이름표만 살고 정의가 빠지면 문서가 밋밋해진다 */
    await page.evaluate(async () => {
      const jan = await import('/v2/src/lib/janFormat.ts') as {
        packJan: (d: unknown) => Promise<Blob>; JAN_MIME: string
      }
      const blob = await jan.packJan({
        title: '남이 보낸 문서',
        html: '<p data-jan-style="head1">남이 보낸 제목</p><p><span data-jan-cstyle="strongC">굵은 낱말</span></p>',
        pageSettings: {
          styles: {
            styles: [
              { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'mono' } },
              { id: 'title', name: '제목', basedOn: 'base', kind: 'paragraph', props: { bold: true, fontSize: 20 } },
              { id: 'head1', name: '제목1', basedOn: 'title', kind: 'paragraph', props: { fontSize: 31 } },
              { id: 'strongC', name: '강조(글자)', basedOn: null, kind: 'character', props: { italic: true } },
            ],
          },
        },
      })
      const file = new File([blob], '남이 보낸 문서.jan', { type: jan.JAN_MIME })
      ;(window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = async () => [{ getFile: async () => file }]
    })

    await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
    await expect(page.locator('.ProseMirror')).toContainText('남이 보낸 제목', { timeout: 10000 })
    await page.waitForTimeout(600)

    const 값 = await 잰값(page)
    expect(값?.표).toBe('head1')                        // 이름표가 파일을 건너왔다
    expect(값?.글꼴).toMatch(고정폭)                     // 바탕글에서 두 대 내려온 글꼴
    expect(parseFloat(값!.크기)).toBeCloseTo(px(31), 1)  // 파일이 정해 온 제목1 의 크기
    expect(값?.굵기).toBe('700')                         // 제목에서

    const 글자 = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror [data-jan-cstyle="strongC"]') as HTMLElement | null
      return el ? { 글: el.textContent, 기울임: getComputedStyle(el).fontStyle, 굵기: getComputedStyle(el).fontWeight } : null
    })
    expect(글자?.글).toBe('굵은 낱말')
    expect(글자?.기울임).toBe('italic')  // 파일이 고쳐 온 정의 (붙박이 기본값은 굵게였다)
    expect(글자?.굵기).toBe('400')       // 파일이 굵게를 빼 왔으므로 굵지 않다
  })

  test('목차 줄은 이름표 없이도 수준별 서식이 걸린다 — 워드의 TOC 1/2/3', async ({ page }) => {
    await 문서열기(page)

    /* 목차는 만들 때마다 새로 쓰이므로 사람이 붙인 이름표가 남지 않는다.
       그래서 목차 줄은 제 수준(data-indent)을 열쇠로 저절로 걸려야 한다.
       목차를 만드는 쪽(docRefs)의 줄 모양을 그대로 흉내 내어 재 본다. */
    await page.evaluate(() => {
      const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => void } } }
      w.__janEditor.commands.setContent(
        '<p data-jan-field="toc"><strong>목차</strong></p>' +
        '<p data-jan-field="toc" data-indent="0"><a href="#a">첫째 마당</a></p>' +
        '<p data-jan-field="toc" data-indent="1"><a href="#b">둘째 마당</a></p>' +
        '<p data-jan-field="toc" data-indent="2"><a href="#c">셋째 마당</a></p>'
      )
    })
    await page.waitForTimeout(300)

    const 줄들 = () => page.evaluate(() =>
      [...document.querySelectorAll('.ProseMirror p[data-jan-field="toc"]')].map((el) => {
        const cs = getComputedStyle(el as HTMLElement)
        return { 글: (el.textContent || '').trim(), 크기: cs.fontSize, 기울임: cs.fontStyle }
      }))

    const 전 = await 줄들()
    expect(전.length).toBe(4)
    const 처음크기 = 전[0].크기
    expect(전.every((r) => r.크기 === 처음크기)).toBe(true) // 아무것도 안 고쳤으면 그대로다

    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '목차1')
    await dlg.locator('input[aria-label="스타일 글자 크기"]').fill('9')
    await 스타일고르기(dlg, '목차3')
    await dlg.getByRole('button', { name: '스타일 기울임' }).click()
    await page.waitForTimeout(300)

    const 후 = await 줄들()
    const [머리, 첫, 둘, 셋] = 후
    expect(parseFloat(첫.크기)).toBeCloseTo(px(9), 1)   // 목차1 을 고쳤더니
    expect(parseFloat(둘.크기)).toBeCloseTo(px(9), 1)   // 목차2 도 물려받아 따라오고
    expect(parseFloat(셋.크기)).toBeCloseTo(px(9), 1)   // 목차3 까지 세 대를 내려왔다
    expect(셋.기울임).toBe('italic')                     // 기울임은 목차3 제 것이라
    expect(둘.기울임).toBe('normal')                     // 위 수준에는 걸리지 않는다
    expect(머리.크기).toBe(처음크기)                      // 「목차」 머리줄은 목차 줄이 아니다
  })

  test('그림이 든 무거운 문서에서도 스타일이 붙고 살아남는다', async ({ page }) => {
    const bytes = readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')).toString('base64')
    await page.addInitScript((b64: string) => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => {
        const bin = atob(b64)
        const buf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
        const file = new File([buf], '강의 노트.jan')
        return [{ kind: 'file', name: file.name, getFile: async () => file }]
      }
    }, bytes)
    await page.goto('./')
    const doc = page.locator('.ProseMirror').first()
    await doc.waitFor({ state: 'visible', timeout: 15000 })

    await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
    await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
    await expect(doc.locator('img')).toHaveCount(5, { timeout: 30000 })
    await page.waitForTimeout(4000) // 쪽 나눔이 앉을 틈

    await doc.locator('p').first().click()
    const dlg = await 스타일창(page)
    await 스타일고르기(dlg, '제목1')
    await dlg.getByRole('button', { name: '선택한 곳에 적용' }).click()
    await 스타일고르기(dlg, '제목')
    await dlg.locator('select[aria-label="스타일 글꼴"]').selectOption('serif')
    await page.waitForTimeout(400)
    await dlg.locator('.jan-modal-close').click()
    await page.waitForTimeout(1500)

    const 붙은것 = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror [data-jan-style="head1"]') as HTMLElement | null
      if (!el) return null
      const cs = getComputedStyle(el)
      return { 글꼴: cs.fontFamily, 크기: cs.fontSize, 쪽수: document.querySelectorAll('[data-jan-page]').length }
    })
    expect(붙은것).not.toBeNull()
    expect(붙은것!.글꼴).toMatch(명조)
    expect(붙은것!.쪽수).toBeGreaterThan(3) // 여러 쪽짜리 문서 그대로
  })
})
