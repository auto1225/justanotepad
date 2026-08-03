import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STYLE_SHEET, ancestorChain, childrenOf, findStyle, newStyle, normalizeStyleSheet,
  outlineLevelOf, outlineLevelOfElement, propOrigin, resolveStyle, sameStyleSheet,
  styleSheetCss, styleTree, wouldCycle,
} from './docStyles'
import type { NamedStyle, StyleSheet } from './docStyles'

const sheet = (styles: NamedStyle[]): StyleSheet => ({ styles })

describe('스타일 상속', () => {
  it('부모가 정한 값이 자식에게 내려온다', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif', fontSize: 11 } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: {} },
    ])
    expect(resolveStyle(s, 'b1').fontFamily).toBe('serif')
    expect(resolveStyle(s, 'b1').fontSize).toBe(11)
  })

  it('자식이 스스로 정한 값은 지켜진다 — 정하지 않은 값만 내려온다', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif', fontSize: 11 } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { fontSize: 14 } },
    ])
    const r = resolveStyle(s, 'b1')
    expect(r.fontSize).toBe(14)      // 스스로 정한 것
    expect(r.fontFamily).toBe('serif') // 정하지 않아 내려온 것
  })

  it('부모를 고치면 자식의 결과도 함께 바뀐다', () => {
    const styles: NamedStyle[] = [
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif' } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { fontSize: 14 } },
    ]
    expect(resolveStyle(sheet(styles), 'b1').fontFamily).toBe('serif')
    styles[0].props.fontFamily = 'mono'
    expect(resolveStyle(sheet(styles), 'b1').fontFamily).toBe('mono')
    expect(resolveStyle(sheet(styles), 'b1').fontSize).toBe(14) // 제 것은 그대로
  })

  it('여러 대를 잇는다 — 바탕글 → 본문1 → 본문1-강조', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif', color: '#111111' } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { fontSize: 14 } },
      { id: 'b1s', name: '본문1-강조', basedOn: 'b1', kind: 'paragraph', props: { bold: true } },
    ])
    const r = resolveStyle(s, 'b1s')
    expect(r.fontFamily).toBe('serif')  // 할아버지에서
    expect(r.fontSize).toBe(14)          // 아버지에서
    expect(r.bold).toBe(true)            // 제 것
    expect(r.color).toBe('#111111')
    expect(ancestorChain(s, 'b1s').map((x) => x.id)).toEqual(['base', 'b1', 'b1s'])
  })

  it('false 도 정한 값이다 — 자식이 굵기를 끄면 부모의 굵게가 지워진다', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { bold: true } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { bold: false } },
    ])
    expect(resolveStyle(s, 'b1').bold).toBe(false)
  })

  it('어느 값이 어디서 왔는지 짚어 준다', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif' } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { fontSize: 14 } },
    ])
    expect(propOrigin(s, 'b1', 'fontFamily')?.id).toBe('base')
    expect(propOrigin(s, 'b1', 'fontSize')?.id).toBe('b1')
    expect(propOrigin(s, 'b1', 'color')).toBeNull()
  })
})

describe('고리 막기', () => {
  const s = sheet([
    { id: 'a', name: 'A', basedOn: null, kind: 'paragraph', props: {} },
    { id: 'b', name: 'B', basedOn: 'a', kind: 'paragraph', props: {} },
    { id: 'c', name: 'C', basedOn: 'b', kind: 'paragraph', props: {} },
  ])

  it('자기 자신을 기준으로 삼을 수 없다', () => {
    expect(wouldCycle(s, 'a', 'a')).toBe(true)
  })

  it('제 자손을 기준으로 삼을 수 없다', () => {
    expect(wouldCycle(s, 'a', 'c')).toBe(true)
    expect(wouldCycle(s, 'b', 'c')).toBe(true)
  })

  it('남남끼리는 괜찮다', () => {
    expect(wouldCycle(s, 'c', 'a')).toBe(false)
    expect(wouldCycle(s, 'a', null)).toBe(false)
  })

  it('이미 고리가 된 파일을 열어도 멎지 않는다', () => {
    const bad = sheet([
      { id: 'x', name: 'X', basedOn: 'y', kind: 'paragraph', props: { fontSize: 10 } },
      { id: 'y', name: 'Y', basedOn: 'x', kind: 'paragraph', props: { bold: true } },
    ])
    const r = resolveStyle(bad, 'x')
    expect(r.fontSize).toBe(10)
    expect(ancestorChain(bad, 'x').length).toBe(2) // 지나온 자리에서 멈춘다
  })
})

describe('CSS 로 옮기기', () => {
  it('물려받은 값까지 한 규칙에 담는다', () => {
    const s = sheet([
      { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontSize: 11 } },
      { id: 'b1', name: '본문1', basedOn: 'base', kind: 'paragraph', props: { bold: true } },
    ])
    const css = styleSheetCss(s)
    expect(css).toContain('[data-jan-style="b1"]')
    expect(css).toContain('font-size: 11pt') // 물려받은 값도 규칙에 들어간다
    expect(css).toContain('font-weight: 700')
  })

  it('글꼴은 변수로도 함께 넘긴다 — 편집기의 !important 규칙을 이기려면 이 길뿐이다', () => {
    const s = sheet([{ id: 'x', name: 'X', basedOn: null, kind: 'paragraph', props: { fontFamily: 'serif' } }])
    expect(styleSheetCss(s)).toContain('--jan-editor-font:')
  })

  it('선택자 무게를 올려 편집기 본문 규칙(0,2,0)을 이긴다', () => {
    const s = sheet([{ id: 'x', name: 'X', basedOn: null, kind: 'paragraph', props: { fontSize: 12 } }])
    expect(styleSheetCss(s)).toContain('[data-jan-style="x"][data-jan-style][data-jan-style]')
  })

  it('글자 스타일은 문단 속성을 뱉지 않는다', () => {
    const s = sheet([{ id: 'c', name: 'C', basedOn: null, kind: 'character', props: { bold: true, indent: 30, align: 'center' } }])
    const css = styleSheetCss(s)
    expect(css).toContain('data-jan-cstyle')
    expect(css).not.toContain('margin-left')
    expect(css).not.toContain('text-align')
  })

  it('수상한 id·색은 CSS 로 새어 나가지 못한다', () => {
    const s = sheet([
      { id: 'a"] { } body {display:none', name: '나쁨', basedOn: null, kind: 'paragraph', props: { fontSize: 12 } },
      { id: 'ok', name: '좋음', basedOn: null, kind: 'paragraph', props: { color: 'red; } body { display:none' } },
    ])
    const css = styleSheetCss(s)
    expect(css).not.toContain('display:none')
    expect(css).not.toContain('body {')
  })
})

describe('파일에서 온 값 다듬기', () => {
  it('빈 값이면 붙박이 한 벌을 준다', () => {
    expect(normalizeStyleSheet(null).styles.length).toBe(DEFAULT_STYLE_SHEET.styles.length)
  })

  it('붙박이가 빠진 파일을 열어도 되살린다', () => {
    const got = normalizeStyleSheet({ styles: [{ id: 'mine', name: '내것', basedOn: null, kind: 'paragraph', props: {} }] })
    expect(findStyle(got, 'mine')).not.toBeNull()
    expect(findStyle(got, 'base')?.name).toBe('바탕글')
  })

  it('없는 부모를 가리키면 끊는다', () => {
    const got = normalizeStyleSheet({ styles: [{ id: 'mine', name: '내것', basedOn: '없는것', kind: 'paragraph', props: {} }] })
    expect(findStyle(got, 'mine')?.basedOn).toBeNull()
  })

  it('사용자가 고친 붙박이 값은 지켜진다', () => {
    const got = normalizeStyleSheet({ styles: [{ id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { fontSize: 18 } }] })
    expect(findStyle(got, 'base')?.props.fontSize).toBe(18)
  })

  it('같은 한 벌인지 견준다', () => {
    expect(sameStyleSheet(DEFAULT_STYLE_SHEET, DEFAULT_STYLE_SHEET)).toBe(true)
    expect(sameStyleSheet(DEFAULT_STYLE_SHEET, { styles: [] })).toBe(true) // 빈 것은 붙박이로 채워진다
    const changed = normalizeStyleSheet(DEFAULT_STYLE_SHEET)
    changed.styles[0].props.fontSize = 30
    expect(sameStyleSheet(DEFAULT_STYLE_SHEET, changed)).toBe(false)
  })
})

describe('붙박이 한 벌', () => {
  it('세 대를 잇는 줄기가 있다', () => {
    expect(ancestorChain(DEFAULT_STYLE_SHEET, 'head2').map((s) => s.id)).toEqual(['base', 'title', 'head1', 'head2'])
  })

  it('목차 1/2/3 은 대를 이어 서 있고, 처음에는 눈에 보이는 값을 정하지 않는다', () => {
    // 기본값을 넣으면 이미 있는 문서의 목차가 말도 없이 달라진다.
    // 개요 수준 0 만 바탕글에서 내려온다 — 목차 줄이 제 목차에 다시 잡히면 안 되니까.
    expect(resolveStyle(DEFAULT_STYLE_SHEET, 'toc3')).toEqual({ outlineLevel: 0 })
    expect(ancestorChain(DEFAULT_STYLE_SHEET, 'toc3').map((s) => s.id)).toEqual(['base', 'toc1', 'toc2', 'toc3'])
  })

  it('목차1 을 고치면 목차 줄에 수준별로 걸린다 — 목차 만드는 쪽은 건드리지 않는다', () => {
    const s = normalizeStyleSheet(DEFAULT_STYLE_SHEET)
    // 아무것도 안 정했을 때는 목차 규칙이 아예 안 나간다 (지금 문서가 그대로여야 한다)
    expect(styleSheetCss(s)).not.toContain('data-jan-field="toc"')

    findStyle(s, 'toc1')!.props.fontSize = 9
    findStyle(s, 'toc3')!.props.italic = true
    const css = styleSheetCss(s)
    expect(css).toContain('p[data-jan-field="toc"]:not([data-indent]):has(> a)')  // 첫 수준
    expect(css).toContain('p[data-jan-field="toc"][data-indent="1"]:has(> a)')     // 둘째 수준
    expect(css).toContain('p[data-jan-field="toc"][data-indent="2"]:has(> a)')     // 셋째 수준
    // 셋째 수준은 크기를 목차1 에서 물려받고 기울임은 제 것이다
    const 셋째 = css.split(/\r?\n/).find((l) => l.includes('data-indent="2"')) || ''
    expect(셋째).toContain('9pt')
    expect(셋째).toContain('italic')
  })

  it('뿌리(바탕글)는 눈에 보이는 값을 아무것도 정하지 않는다 — 표만 붙였는데 글이 달라지면 안 된다', () => {
    // 개요 수준(0)은 눈에 보이지 않으므로 CSS 로 한 줄도 나가면 안 된다
    expect(resolveStyle(DEFAULT_STYLE_SHEET, 'base')).toEqual({ outlineLevel: 0 })
    expect(styleSheetCss(DEFAULT_STYLE_SHEET)).not.toContain('data-jan-style="base"')
  })

  it('나무 차례로 늘어놓으면 자식이 부모 뒤에 온다', () => {
    const tree = styleTree(DEFAULT_STYLE_SHEET, 'paragraph')
    const ids = tree.map((t) => t.style.id)
    expect(ids.indexOf('base')).toBeLessThan(ids.indexOf('head1'))
    expect(tree.find((t) => t.style.id === 'head2')?.depth).toBe(3)
    expect(tree.every((t) => t.style.kind === 'paragraph')).toBe(true)
  })

  it('자식 목록을 셀 수 있다', () => {
    expect(childrenOf(DEFAULT_STYLE_SHEET, 'title').map((s) => s.id)).toEqual(['head1'])
  })
})

describe('새 스타일', () => {
  it('기준을 골라 만든다', () => {
    const s = newStyle(DEFAULT_STYLE_SHEET, '내 제목', 'head1')
    expect(s.basedOn).toBe('head1')
    expect(s.props).toEqual({})
  })

  it('이름이 비면 기본 이름을 준다', () => {
    expect(newStyle(DEFAULT_STYLE_SHEET, '   ', null).name).toBe('새 스타일')
  })
})


describe('개요 수준', () => {
  const 문단 = (attrs: Record<string, unknown> = {}) => ({ type: { name: 'paragraph' }, attrs })
  const 제목 = (level: number, attrs: Record<string, unknown> = {}) => ({ type: { name: 'heading' }, attrs: { level, ...attrs } })

  it('스타일이 정한 수준을 읽는다 — 문단이 h1 이 아니어도 제목이 된다', () => {
    expect(outlineLevelOf(문단({ janStyle: 'head2' }), DEFAULT_STYLE_SHEET)).toBe(2)
    expect(outlineLevelOf(문단({ janStyle: 'head3' }), DEFAULT_STYLE_SHEET)).toBe(3)
  })

  it('정하지 않았으면 기준 스타일에서 내려온다 — 제목1 은 「제목」 의 수준을 쓴다', () => {
    expect(findStyle(DEFAULT_STYLE_SHEET, 'head1')!.props.outlineLevel).toBeUndefined()
    expect(outlineLevelOf(문단({ janStyle: 'head1' }), DEFAULT_STYLE_SHEET)).toBe(1)
    expect(propOrigin(DEFAULT_STYLE_SHEET, 'head1', 'outlineLevel')?.id).toBe('title')
  })

  it('부모의 수준을 고치면 자식도 따라 바뀐다', () => {
    const s = normalizeStyleSheet(DEFAULT_STYLE_SHEET)
    findStyle(s, 'title')!.props.outlineLevel = 4
    expect(outlineLevelOf(문단({ janStyle: 'head1' }), s)).toBe(4)   // 물려받는 쪽은 따라오고
    expect(outlineLevelOf(문단({ janStyle: 'head2' }), s)).toBe(2)   // 제 것을 정한 쪽은 그대로
  })

  it('스타일이 없으면 태그에서 읽는다 — 이미 h1~h3 로 쓰인 문서가 그대로 살아야 한다', () => {
    expect(outlineLevelOf(제목(1), DEFAULT_STYLE_SHEET)).toBe(1)
    expect(outlineLevelOf(제목(3), DEFAULT_STYLE_SHEET)).toBe(3)
    expect(outlineLevelOf(문단(), DEFAULT_STYLE_SHEET)).toBe(0)
  })

  it('스타일이 태그를 이긴다 — h1 에 「바탕글」 을 붙이면 본문이 된다', () => {
    expect(outlineLevelOf(제목(1, { janStyle: 'base' }), DEFAULT_STYLE_SHEET)).toBe(0)
    expect(outlineLevelOf(제목(1, { janStyle: 'head3' }), DEFAULT_STYLE_SHEET)).toBe(3)
  })

  it('수준을 정한 조상이 아무도 없으면 태그로 떨어진다', () => {
    const s = { styles: [{ id: 'mine', name: '내것', basedOn: null, kind: 'paragraph' as const, props: {} }] }
    expect(outlineLevelOf(제목(2, { janStyle: 'mine' }), s)).toBe(2)
    expect(outlineLevelOf(문단({ janStyle: 'mine' }), s)).toBe(0)
  })

  it('없는 스타일을 가리켜도 태그로 떨어진다 (남이 만든 파일)', () => {
    expect(outlineLevelOf(제목(2, { janStyle: '없는것' }), DEFAULT_STYLE_SHEET)).toBe(2)
  })

  it('고리가 있어도 멎지 않는다', () => {
    const bad = {
      styles: [
        { id: 'x', name: 'X', basedOn: 'y', kind: 'paragraph' as const, props: { outlineLevel: 5 } },
        { id: 'y', name: 'Y', basedOn: 'x', kind: 'paragraph' as const, props: {} },
      ],
    }
    expect(outlineLevelOf(문단({ janStyle: 'x' }), bad)).toBe(5)
  })

  it('터무니없는 값은 다듬는다', () => {
    const s = normalizeStyleSheet({ styles: [{ id: 'a', name: 'A', basedOn: null, kind: 'paragraph', props: { outlineLevel: 99 } }] })
    expect(findStyle(s, 'a')!.props.outlineLevel).toBe(9)
    const m = normalizeStyleSheet({ styles: [{ id: 'b', name: 'B', basedOn: null, kind: 'paragraph', props: { outlineLevel: -3 } }] })
    expect(findStyle(m, 'b')!.props.outlineLevel).toBe(0)
  })

  it('개요 수준은 CSS 로 한 줄도 나가지 않는다 — 눈에 보이는 값이 아니다', () => {
    const s = { styles: [{ id: 'z', name: 'Z', basedOn: null, kind: 'paragraph' as const, props: { outlineLevel: 3 } }] }
    expect(styleSheetCss(s)).toBe('')
  })

  it('DOM 요소에서도 같은 답이 나온다 — 목차는 그려진 것을 훑는다', () => {
    const 만들기 = (tag: string, styleId?: string) => {
      const el = document.createElement(tag)
      if (styleId) el.setAttribute('data-jan-style', styleId)
      return el
    }
    expect(outlineLevelOfElement(만들기('p', 'head2'), DEFAULT_STYLE_SHEET)).toBe(2)
    expect(outlineLevelOfElement(만들기('h1'), DEFAULT_STYLE_SHEET)).toBe(1)
    expect(outlineLevelOfElement(만들기('h1', 'base'), DEFAULT_STYLE_SHEET)).toBe(0)
    expect(outlineLevelOfElement(만들기('p'), DEFAULT_STYLE_SHEET)).toBe(0)
  })
})
