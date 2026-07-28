import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core'

/**
 * 글자에 붙는 입력 것들 —
 *  · 드롭캡(단락 첫 문자 장식)  워드 「삽입 › 단락의 첫 문자 장식」
 *  · 덧말(루비)                한글 「입력 › 덧말 넣기」 (워드는 위쪽만 되는 윗주)
 *  · 강조점                    한글 「글자 모양 › 강조점」 (워드에 없다)
 *  · 글자 겹치기               한글 「입력 › 글자 겹치기」 (워드는 한 글자·원/사각만)
 *
 * 모두 저장본이 곧 화면이 되도록 표준 HTML 로 나간다 (ruby·rt, CSS text-emphasis).
 */

/* ── 드롭캡 — 문단 속성 ────────────────────────────────── */

export const DROPCAP_LINES = [2, 3, 4, 5] as const

export const DropCapAttr = Extension.create({
  name: 'janDropCap',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          dropcap: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-dropcap'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.dropcap ? { 'data-dropcap': String(attrs.dropcap) } : {},
          },
        },
      },
    ]
  },
})

/* ── 덧말 (루비) ──────────────────────────────────────── */

export const RubyText = Node.create({
  name: 'janRuby',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      base: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-base') || el.firstChild?.textContent || '' },
      /** 덧말 — 본말 위(over) 또는 아래(under). 한글은 아래도 된다. */
      note: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-note') || el.querySelector('rt')?.textContent || '' },
      pos: { default: 'over', parseHTML: (el: HTMLElement) => el.getAttribute('data-pos') || 'over' },
    }
  },

  parseHTML() {
    return [{ tag: 'ruby[data-jan-ruby]' }, { tag: 'ruby' }]
  },

  renderHTML({ node }) {
    const { base, note, pos } = node.attrs as { base: string; note: string; pos: string }
    return [
      'ruby',
      {
        'data-jan-ruby': '1',
        'data-base': base,
        'data-note': note,
        'data-pos': pos,
        class: 'jan-ruby',
        style: pos === 'under' ? 'ruby-position:under;-webkit-ruby-position:under;' : '',
      },
      base,
      ['rt', {}, note],
    ]
  },
})

/* ── 강조점 — 글자에 붙는 표시 ──────────────────────────── */

export const EMPHASIS_MARKS: { key: string; label: string; css: string }[] = [
  { key: 'dot', label: '점 (●)', css: 'filled dot' },
  { key: 'open-dot', label: '흰 점 (○)', css: 'open dot' },
  { key: 'circle', label: '동그라미', css: 'filled circle' },
  { key: 'open-circle', label: '흰 동그라미', css: 'open circle' },
  { key: 'triangle', label: '세모', css: 'filled triangle' },
  { key: 'open-triangle', label: '흰 세모', css: 'open triangle' },
  { key: 'sesame', label: '깨 (﹅)', css: 'filled sesame' },
  { key: 'open-sesame', label: '흰 깨', css: 'open sesame' },
  { key: 'double-circle', label: '겹동그라미', css: 'filled double-circle' },
]

export const EmphasisDot = Mark.create({
  name: 'janEmphasis',

  addAttributes() {
    return {
      kind: { default: 'dot', parseHTML: (el: HTMLElement) => el.getAttribute('data-emph') || 'dot' },
      /** 글자 위(over)·아래(under) — 한글처럼 둘 다 된다 */
      pos: { default: 'over', parseHTML: (el: HTMLElement) => el.getAttribute('data-emph-pos') || 'over' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-emph]' }]
  },

  renderHTML({ mark }) {
    const kind = String(mark.attrs.kind || 'dot')
    const pos = String(mark.attrs.pos || 'over')
    const css = EMPHASIS_MARKS.find((m) => m.key === kind)?.css || 'filled dot'
    return [
      'span',
      mergeAttributes(
        { 'data-emph': kind, 'data-emph-pos': pos, class: 'jan-emph' },
        { style: `text-emphasis:${css};-webkit-text-emphasis:${css};text-emphasis-position:${pos === 'under' ? 'under left' : 'over right'};` }
      ),
      0,
    ]
  },
})

/* ── 글자 겹치기 ──────────────────────────────────────── */

export const OVERLAP_FRAMES: { key: string; label: string }[] = [
  { key: 'none', label: '테두리 없음' },
  { key: 'circle', label: '원' },
  { key: 'square', label: '사각형' },
  { key: 'triangle', label: '삼각형' },
  { key: 'diamond', label: '마름모' },
  { key: 'double-circle', label: '겹원' },
]

export const CharOverlap = Node.create({
  name: 'janOverlap',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      /** 겹칠 글자 — 한글처럼 최대 아홉 자 */
      chars: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-chars') || el.textContent || '' },
      frame: { default: 'circle', parseHTML: (el: HTMLElement) => el.getAttribute('data-frame') || 'circle' },
      /** 겹치기 크기 50~150 % */
      scale: { default: 100, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-scale')) || 100 },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-overlap]' }]
  },

  renderHTML({ node }) {
    const chars = String(node.attrs.chars || '').slice(0, 9)
    const frame = String(node.attrs.frame || 'circle')
    const scale = Number(node.attrs.scale) || 100
    return [
      'span',
      {
        'data-jan-overlap': '1',
        'data-chars': chars,
        'data-frame': frame,
        'data-scale': String(scale),
        class: `jan-overlap jan-overlap-${frame}`,
        style: `font-size:${scale}%;`,
      },
      ...[...chars].map((ch) => ['span', { class: 'jan-overlap-ch' }, ch] as unknown),
    ] as never
  },
})
