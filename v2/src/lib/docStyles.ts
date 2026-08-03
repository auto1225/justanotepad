/**
 * 이름 있는 스타일과 상속 — 워드 「기준 스타일(based on)」 · 한글 「스타일 마당」 자리.
 *
 * 여태 우리 스타일은 모두 「한 번짜리 명령」 이었다. 스타일 갤러리는 그 자리에서 마크를
 * 입히고 끝났고, 내 스타일은 마크 묶음을 localStorage 에 담았다 다시 입힐 뿐이었다.
 * 그래서 「제목 글꼴을 바꾼다」 가 「이미 쓴 제목을 하나하나 다시 고른다」 였다.
 *
 * 여기서는 반대로 한다.
 *  - 문단에는 「이 스타일이다」 라는 표만 붙는다 (data-jan-style="본문").
 *    서식 값은 문단에 복사되지 않는다.
 *  - 서식 값은 스타일 정의 한 곳에만 산다. 정의를 고치면 표를 단 글이 모두 함께 바뀐다.
 *  - 스타일은 기준 스타일(basedOn)을 가질 수 있다. 스스로 정하지 않은 값만 위에서 내려온다.
 *
 * 화면에 입히는 길은 CSS 한 장이다 (styleSheetCss). 문단마다 인라인 서식을 뿌리지 않는
 * 이유가 여기 있다 — 인라인으로 뿌리면 정의를 고칠 때 문서를 통째로 다시 써야 하고,
 * 사람이 직접 고른 서식(직접 서식)과 뒤엉켜 무엇이 이겼는지 알 수 없게 된다.
 * CSS 로 두면 직접 서식(인라인 style)이 언제나 스타일을 이긴다 — 워드·한글과 같은 차례다.
 */

export type StyleKind = 'paragraph' | 'character'

/** 스타일이 「스스로 정한」 값만 담는다. 빠진 값은 기준 스타일에서 내려온다. */
export interface StyleProps {
  /** 'sans' | 'serif' | 'mono' 또는 실제 글꼴 이름 */
  fontFamily?: string
  /** pt */
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** 글자 색 (#rrggbb) */
  color?: string
  /** 음영 (#rrggbb) */
  shading?: string
  /** 줄 간격 배수 */
  lineHeight?: number
  /** 문단 앞·뒤 공백 (px) */
  spaceBefore?: number
  spaceAfter?: number
  /** 왼쪽 들여쓰기 (px) */
  indent?: number
  /** 첫 줄 들여쓰기 (px, 음수면 내어쓰기) */
  firstLine?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  /**
   * 개요 수준 — 0 은 본문, 1~9 는 제목 수준 (워드 「단락 → 개요 수준」).
   *
   * 이것만은 눈에 보이는 값이 아니다. CSS 로 나가지 않고, 목차·개요가 문서의 뼈대를
   * 읽을 때 쓴다. 여태 뼈대는 태그 이름(h1~h3)만 보았다 — 그래서 「제목1」 스타일을
   * 붙인 문단은 목차에 잡히지 않았다. 이 값이 그 자리를 메운다.
   */
  outlineLevel?: number
}

export interface NamedStyle {
  /** 문서 안에서 변하지 않는 열쇠 — 이름을 바꿔도 문단의 표는 그대로다 */
  id: string
  name: string
  /** 기준 스타일의 id. null 이면 뿌리 */
  basedOn: string | null
  kind: StyleKind
  /** 스스로 정한 값만 */
  props: StyleProps
  /** 붙박이 스타일은 지울 수 없다 (고칠 수는 있다) */
  builtin?: boolean
}

export interface StyleSheet {
  styles: NamedStyle[]
}

/* ── 붙박이 한 벌 ────────────────────────────────────────────────
 * 뿌리(바탕글)는 눈에 보이는 값을 아무것도 정하지 않는다 — 워드의 Normal 과 같다.
 * 표만 붙였을 뿐인데 글이 달라 보이면 사람이 놀란다.
 * (개요 수준만은 예외로 0 을 못 박는다 — 눈에 보이지 않고, 「이 스타일은 본문이다」 라는
 *  뜻을 아래로 흘려보내야 목차가 제목 아닌 것을 제목으로 잡지 않는다.)
 * 대신 아래로 갈수록 저마다 한두 가지씩 더한다. 세 대를 잇는 줄기를 일부러 둘 넣었다:
 *   바탕글 → 제목 → 제목1 · 바탕글 → 본문 → 본문-강조
 */
export const BUILTIN_STYLES: NamedStyle[] = [
  { id: 'base', name: '바탕글', basedOn: null, kind: 'paragraph', props: { outlineLevel: 0 }, builtin: true },

  { id: 'body', name: '본문', basedOn: 'base', kind: 'paragraph', props: { spaceAfter: 8 }, builtin: true },
  { id: 'bodyStrong', name: '본문-강조', basedOn: 'body', kind: 'paragraph', props: { bold: true }, builtin: true },

  /* 제목 줄기는 개요 수준을 함께 지닌다 — 제목1 은 제 것을 정하지 않고 「제목」 에서 물려받는다 */
  { id: 'title', name: '제목', basedOn: 'base', kind: 'paragraph', props: { bold: true, fontSize: 20, spaceBefore: 18, spaceAfter: 8, outlineLevel: 1 }, builtin: true },
  { id: 'head1', name: '제목1', basedOn: 'title', kind: 'paragraph', props: { fontSize: 17 }, builtin: true },
  { id: 'head2', name: '제목2', basedOn: 'head1', kind: 'paragraph', props: { fontSize: 14, outlineLevel: 2 }, builtin: true },
  { id: 'head3', name: '제목3', basedOn: 'head2', kind: 'paragraph', props: { fontSize: 12, outlineLevel: 3 }, builtin: true },

  { id: 'quote', name: '인용', basedOn: 'base', kind: 'paragraph', props: { italic: true, indent: 24, color: '#555555' }, builtin: true },

  /* 목차 수준별 서식 — 워드의 TOC 1/2/3. 상속이 생겼으니 자연히 얹힌다.
     이 셋은 아무 값도 정하지 않고 시작한다: 목차 줄에는 사람이 표를 붙이는 것이 아니라
     수준을 보고 저절로 걸리므로(TOC_LEVEL_STYLES), 기본값을 넣으면 이미 있는 문서의
     목차 생김새가 말도 없이 달라진다. 사람이 스타일 창에서 고치는 순간부터 걸린다. */
  { id: 'toc1', name: '목차1', basedOn: 'base', kind: 'paragraph', props: {}, builtin: true },
  { id: 'toc2', name: '목차2', basedOn: 'toc1', kind: 'paragraph', props: {}, builtin: true },
  { id: 'toc3', name: '목차3', basedOn: 'toc2', kind: 'paragraph', props: {}, builtin: true },

  { id: 'strongC', name: '강조(글자)', basedOn: null, kind: 'character', props: { bold: true }, builtin: true },
  { id: 'refC', name: '참조(글자)', basedOn: 'strongC', kind: 'character', props: { color: '#8a8f98', fontSize: 9 }, builtin: true },
]

export const DEFAULT_STYLE_SHEET: StyleSheet = { styles: BUILTIN_STYLES }

export function findStyle(sheet: StyleSheet, id: string | null | undefined): NamedStyle | null {
  if (!id) return null
  return sheet.styles.find((s) => s.id === id) || null
}

/**
 * 뿌리부터 자기까지의 줄기. 고리가 있으면 이미 지나온 자리에서 멈춘다 —
 * 고리를 만들지 못하게 막아 두지만(wouldCycle), 남이 만든 파일을 열 때는 믿을 수 없다.
 * 여기서 멈추지 않으면 화면이 멎는다.
 */
export function ancestorChain(sheet: StyleSheet, id: string): NamedStyle[] {
  const chain: NamedStyle[] = []
  const seen = new Set<string>()
  let cur = findStyle(sheet, id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift(cur)
    cur = findStyle(sheet, cur.basedOn)
  }
  return chain
}

/** 값이 정해진 것만 남긴다 — undefined 는 「정하지 않았다」 이므로 부모 값을 덮으면 안 된다 */
function definedOnly(props: StyleProps): StyleProps {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out as StyleProps
}

/**
 * 실제로 화면에 나타날 값 — 위에서부터 흘러내리고, 아래가 이긴다.
 * 「본문1 이 스스로 정한 크기는 지켜지고, 정하지 않은 글꼴만 바탕글에서 내려온다」 가 이것이다.
 */
export function resolveStyle(sheet: StyleSheet, id: string): StyleProps {
  let out: StyleProps = {}
  for (const s of ancestorChain(sheet, id)) out = { ...out, ...definedOnly(s.props) }
  return out
}

/** 어떤 값이 어느 스타일에서 왔는지 — 스타일 창에서 「물려받음」 을 표시하는 데 쓴다 */
export function propOrigin(sheet: StyleSheet, id: string, key: keyof StyleProps): NamedStyle | null {
  let from: NamedStyle | null = null
  for (const s of ancestorChain(sheet, id)) {
    const v = s.props[key]
    if (v !== undefined && v !== null && v !== '') from = s
  }
  return from
}

/** id 를 부모로 삼으면 고리가 되는가 — 자기 자신이거나 제 자손을 부모로 삼는 경우 */
export function wouldCycle(sheet: StyleSheet, id: string, parentId: string | null): boolean {
  if (!parentId) return false
  if (parentId === id) return true
  const seen = new Set<string>()
  let cur = findStyle(sheet, parentId)
  while (cur && !seen.has(cur.id)) {
    if (cur.id === id) return true
    seen.add(cur.id)
    cur = findStyle(sheet, cur.basedOn)
  }
  return false
}

/** 이 스타일을 기준으로 삼은 것들 */
export function childrenOf(sheet: StyleSheet, id: string | null): NamedStyle[] {
  return sheet.styles.filter((s) => s.basedOn === id)
}

/** 스타일 창에 나열할 차례 — 뿌리부터 대를 이어 들여쓴 목록 */
export function styleTree(sheet: StyleSheet, kind?: StyleKind): Array<{ style: NamedStyle; depth: number }> {
  const out: Array<{ style: NamedStyle; depth: number }> = []
  const seen = new Set<string>()
  const walk = (parent: string | null, depth: number) => {
    for (const s of sheet.styles) {
      if (s.basedOn !== parent) continue
      if (seen.has(s.id)) continue
      if (kind && s.kind !== kind) continue
      seen.add(s.id)
      out.push({ style: s, depth })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  // 부모를 잃은 스타일(파일이 깨졌을 때)도 빠뜨리지 않는다
  for (const s of sheet.styles) {
    if (seen.has(s.id)) continue
    if (kind && s.kind !== kind) continue
    out.push({ style: s, depth: 0 })
  }
  return out
}

/* ── CSS 로 옮기기 ──────────────────────────────────────────── */

export function fontStack(v: string): string {
  if (v === 'serif') return "'Noto Serif KR', 'Nanum Myeongjo', 'Batang', serif"
  if (v === 'mono') return "'D2Coding', 'Consolas', 'Noto Sans Mono', monospace"
  if (v === 'sans') return "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif"
  return `'${v.replace(/'/g, '')}', 'Noto Sans KR', sans-serif`
}

/** CSS 값에 그대로 넣어도 되는 색인지 (남이 만든 파일에서 온 값이 CSS 를 깨지 못하게) */
function safeColor(v: string): string | null {
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : null
}

function declarations(props: StyleProps, kind: StyleKind): string[] {
  const out: string[] = []
  if (props.fontFamily) {
    const stack = fontStack(props.fontFamily)
    /* 글꼴만은 변수로도 넘긴다.
       .jan-editor-pages .ProseMirror :where(...) 가 문단 「안」 요소들의 글꼴을
       바닥값으로 따로 잡기 때문에, font-family 만 주면 문단은 따라와도
       그 안의 span(굵게·색 따위)은 문서 글꼴로 돌아가 버린다.
       그 규칙이 읽는 변수를 이 문단에서 갈아 주면 안쪽 글까지 함께 따라온다.
       (2026-08 이전에는 그 규칙이 !important 라 이 변수가 유일한 길이었다.
        지금은 인라인 직접 서식이 정상으로 이긴다 — 이 파일 첫머리의 차례 그대로다.) */
    out.push(`--jan-editor-font: ${stack}`)
    out.push(`font-family: ${stack}`)
  }
  if (props.fontSize) out.push(`font-size: ${props.fontSize}pt`)
  if (props.bold !== undefined) out.push(`font-weight: ${props.bold ? 700 : 400}`)
  if (props.italic !== undefined) out.push(`font-style: ${props.italic ? 'italic' : 'normal'}`)
  if (props.underline !== undefined) out.push(`text-decoration-line: ${props.underline ? 'underline' : 'none'}`)
  if (props.color) { const c = safeColor(props.color); if (c) out.push(`color: ${c}`) }
  if (props.shading) { const c = safeColor(props.shading); if (c) out.push(`background-color: ${c}`) }
  if (kind === 'character') return out
  if (props.lineHeight) out.push(`line-height: ${props.lineHeight}`)
  if (props.spaceBefore !== undefined) out.push(`margin-top: ${props.spaceBefore}px`)
  if (props.spaceAfter !== undefined) out.push(`margin-bottom: ${props.spaceAfter}px`)
  if (props.indent !== undefined) out.push(`margin-left: ${props.indent}px`)
  if (props.firstLine !== undefined) out.push(`text-indent: ${props.firstLine}px`)
  if (props.align) out.push(`text-align: ${props.align}`)
  return out
}

/** CSS 에 넣어도 안전한 열쇠만 — 남이 만든 파일의 id 가 선택자를 빠져나가지 못하게 */
export function safeStyleId(id: string): string {
  return /^[A-Za-z0-9가-힣_-]{1,40}$/.test(id) ? id : ''
}

/**
 * 스타일 한 벌 → CSS 한 장.
 *
 * 선택자에 같은 속성을 세 번 겹쳐 쓴 것은 장난이 아니다. 편집기 본문 규칙이
 * `.jan-editor-pages .ProseMirror :where(...)` (무게 0,2,0) 라서, 속성 하나짜리(0,1,0)로는
 * 진다. 조상 클래스에 기대면 내보낸 파일에서 안 먹으므로 속성만으로 무게를 올린다.
 */
export function styleSheetCss(sheet: StyleSheet): string {
  const lines: string[] = []
  for (const s of sheet.styles) {
    const id = safeStyleId(s.id)
    if (!id) continue
    const decls = declarations(resolveStyle(sheet, s.id), s.kind)
    if (!decls.length) continue
    const attr = s.kind === 'character' ? 'data-jan-cstyle' : 'data-jan-style'
    const sel = `[${attr}="${id}"][${attr}][${attr}]`
    lines.push(`${sel} { ${decls.join('; ')}; }`)
  }
  lines.push(...tocLevelCss(sheet))
  return lines.join('\n')
}

/** 목차 수준별 서식이 걸리는 스타일 — 워드의 TOC 1/2/3 */
export const TOC_LEVEL_STYLES = ['toc1', 'toc2', 'toc3']

/**
 * 목차 줄에는 사람이 이름표를 붙이지 않는다 — 목차는 만들 때마다 새로 쓰이므로
 * 붙여 둔 표가 남지 않는다. 워드도 수준을 보고 TOC 1/2/3 을 저절로 건다.
 *
 * 우리 목차 줄은 제 수준을 data-indent 로 이미 지니고 있다 (docRefs 의 putToc).
 * 그것을 열쇠로 삼으면 목차를 만드는 쪽을 건드리지 않고도 수준별 서식이 걸린다.
 * 「목차」 라는 머리줄과 가려내려고 :has(> a) 를 쓴다 — 줄에는 링크가 있고 머리줄에는 없다
 * (class 는 저장·재파싱에서 벗겨지므로 기댈 수 없다).
 *
 * 들여쓰기만은 목차 줄이 제 인라인 값을 이미 갖고 있어 그쪽이 이긴다 (직접 서식이 먼저다).
 */
function tocLevelCss(sheet: StyleSheet): string[] {
  const out: string[] = []
  TOC_LEVEL_STYLES.forEach((id, level) => {
    if (!findStyle(sheet, id)) return
    const decls = declarations(resolveStyle(sheet, id), 'paragraph')
    if (!decls.length) return
    /* 첫 수준은 data-indent 가 0 이라 아예 속성이 붙지 않는다 (Indent 가 0 이면 안 그린다) */
    const level표 = level === 0 ? ':not([data-indent])' : `[data-indent="${level}"]`
    out.push(`p[data-jan-field="toc"]${level표}:has(> a) { ${decls.join('; ')}; }`)
  })
  return out
}

/* ── 개요 수준 읽기 ────────────────────────────────────────────
 *
 * 목차와 개요 패널은 여태 태그 이름(h1~h3)만 보았다. 그래서 「제목1」 스타일을 붙인
 * 문단은 아무리 제목처럼 보여도 목차에 잡히지 않았다 — 워드는 태그가 아니라
 * 개요 수준을 읽는다.
 *
 * 여기 두 함수가 그 하나뿐인 창구다. 스타일이 정한 것이 있으면 그것을 쓰고,
 * 없으면 태그로 떨어진다 — 그래야 이미 h1~h3 로 쓰인 문서가 그대로 산다.
 * 목차·개요 쪽은 제 손으로 태그를 재지 말고 이것만 부르면 된다.
 */

/** PM 노드든 흉내 낸 것이든 이만큼만 있으면 된다 (시험에서 진짜 문서를 짓지 않아도 되게) */
export interface OutlineNodeLike {
  type: { name: string }
  attrs?: Record<string, unknown> | null
}

const MAX_OUTLINE = 9

function levelFromStyle(styleId: unknown, sheet: StyleSheet): number | null {
  if (typeof styleId !== 'string' || !styleId) return null
  const lv = resolveStyle(sheet, styleId).outlineLevel
  return typeof lv === 'number' ? Math.max(0, Math.min(MAX_OUTLINE, Math.round(lv))) : null
}

/**
 * 이 문단의 개요 수준 — 스타일이 정한 것이 없으면 태그(h1~h6)에서, 그것도 아니면 0.
 *
 * 스타일이 태그를 이긴다 (워드와 같다): h1 에 「바탕글」 을 붙이면 본문(0)이 된다.
 * 「바탕글」 이 개요 수준 0 을 못 박아 두는 까닭이 이것이다.
 */
export function outlineLevelOf(node: OutlineNodeLike, sheet: StyleSheet = currentStyleSheet()): number {
  const byStyle = levelFromStyle(node.attrs?.janStyle, sheet)
  if (byStyle !== null) return byStyle
  if (node.type?.name === 'heading') {
    const lv = Number(node.attrs?.level)
    return Number.isFinite(lv) ? Math.max(1, Math.min(MAX_OUTLINE, Math.round(lv))) : 1
  }
  return 0
}

/**
 * 같은 것을 DOM 요소에서 — 목차는 화면에 그려진 것을 훑어 쪽 번호까지 재므로
 * 노드가 아니라 요소를 손에 쥔다 (docRefs 의 collectHeadings).
 */
export function outlineLevelOfElement(el: Element, sheet: StyleSheet = currentStyleSheet()): number {
  const byStyle = levelFromStyle(el.getAttribute('data-jan-style'), sheet)
  if (byStyle !== null) return byStyle
  const m = /^H([1-6])$/.exec(el.tagName)
  return m ? Number(m[1]) : 0
}

/* ── 화면에 입히기 ──────────────────────────────────────────── */

const STYLE_TAG_ID = 'jan-doc-style-sheet'

/**
 * 지금 걸린 한 벌은 이 조각(module) 안이 아니라 창 하나에 둔다.
 *
 * 조각 안 변수에 담았더니 조각이 두 벌 실릴 때 서로 다른 답을 내놓았다 —
 * 개발 서버가 고친 파일에 딱지를 붙여 새 주소로 내주면 앱이 쥔 것과 나중에 부른 것이
 * 다른 조각이 된다. 실물로 쟀다: 스타일 창에서 개요 수준을 4 로 고쳤는데
 * 나중에 부른 쪽은 여전히 1 이라고 답했다.
 *
 * 창 하나에 두면 조각이 몇 벌이든 답이 하나다. 인쇄용 틀·쪽지 창처럼 문서가 여럿일 때도
 * 같은 한 벌을 본다 (입히는 곳만 doc 으로 갈라 준다).
 */
const ACTIVE_KEY = '__janActiveStyleSheet'

/** 지금 문서에 걸린 한 벌 — 내보내기 CSS 와 개요 수준 읽기가 이걸 쓴다 */
export function currentStyleSheet(): StyleSheet {
  const held = (globalThis as Record<string, unknown>)[ACTIVE_KEY]
  return (held as StyleSheet) || DEFAULT_STYLE_SHEET
}

export function applyStyleSheet(sheet: StyleSheet, doc: Document = document): void {
  ;(globalThis as Record<string, unknown>)[ACTIVE_KEY] = sheet
  let tag = doc.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!tag) {
    tag = doc.createElement('style')
    tag.id = STYLE_TAG_ID
    doc.head.appendChild(tag)
  }
  const css = styleSheetCss(sheet)
  if (tag.textContent !== css) tag.textContent = css
}

/* ── 파일에서 온 값 다듬기 ──────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

const ALIGNS = ['left', 'center', 'right', 'justify']

function normalizeProps(v: unknown): StyleProps {
  const raw = isRecord(v) ? v : {}
  const out: StyleProps = {}
  const num = (x: unknown, min: number, max: number) => {
    const n = Number(x)
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined
  }
  if (typeof raw.fontFamily === 'string' && raw.fontFamily) out.fontFamily = raw.fontFamily.slice(0, 60)
  const fs = num(raw.fontSize, 4, 200); if (fs !== undefined && raw.fontSize !== undefined) out.fontSize = fs
  if (typeof raw.bold === 'boolean') out.bold = raw.bold
  if (typeof raw.italic === 'boolean') out.italic = raw.italic
  if (typeof raw.underline === 'boolean') out.underline = raw.underline
  if (typeof raw.color === 'string' && safeColor(raw.color)) out.color = raw.color
  if (typeof raw.shading === 'string' && safeColor(raw.shading)) out.shading = raw.shading
  const lh = num(raw.lineHeight, 0.5, 5); if (lh !== undefined && raw.lineHeight !== undefined) out.lineHeight = lh
  const sb = num(raw.spaceBefore, 0, 400); if (sb !== undefined && raw.spaceBefore !== undefined) out.spaceBefore = sb
  const sa = num(raw.spaceAfter, 0, 400); if (sa !== undefined && raw.spaceAfter !== undefined) out.spaceAfter = sa
  const ind = num(raw.indent, 0, 800); if (ind !== undefined && raw.indent !== undefined) out.indent = ind
  const fl = num(raw.firstLine, -400, 400); if (fl !== undefined && raw.firstLine !== undefined) out.firstLine = fl
  if (typeof raw.align === 'string' && ALIGNS.includes(raw.align)) out.align = raw.align as StyleProps['align']
  const ol = num(raw.outlineLevel, 0, 9); if (ol !== undefined && raw.outlineLevel !== undefined) out.outlineLevel = Math.round(ol)
  return out
}

/**
 * 저장본에서 온 한 벌을 믿을 수 있는 모양으로.
 * 붙박이는 언제나 있어야 한다 — 파일에 없더라도 되살린다. 없으면 표만 붙은 채
 * 아무 서식도 없는 문단이 남는다.
 */
export function normalizeStyleSheet(value: unknown, fallback: StyleSheet = DEFAULT_STYLE_SHEET): StyleSheet {
  const raw = isRecord(value) ? value : null
  const list = raw && Array.isArray(raw.styles) ? raw.styles : null
  if (!list) return { styles: fallback.styles.map((s) => ({ ...s, props: normalizeProps(s.props) })) }

  const out: NamedStyle[] = []
  const seen = new Set<string>()
  for (const item of list.slice(0, 200)) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? safeStyleId(item.id) : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const builtin = BUILTIN_STYLES.find((b) => b.id === id)
    out.push({
      id,
      name: (typeof item.name === 'string' && item.name.trim() ? item.name.trim() : builtin?.name || id).slice(0, 30),
      basedOn: typeof item.basedOn === 'string' && item.basedOn ? safeStyleId(item.basedOn) || null : null,
      kind: item.kind === 'character' ? 'character' : 'paragraph',
      props: normalizeProps(item.props),
      builtin: !!builtin,
    })
  }
  // 빠진 붙박이를 되살린다
  for (const b of BUILTIN_STYLES) {
    if (!seen.has(b.id)) out.push({ ...b, props: normalizeProps(b.props) })
  }
  // 없는 부모를 가리키는 표는 끊는다 (고리는 ancestorChain 이 또 한 번 막는다)
  const ids = new Set(out.map((s) => s.id))
  for (const s of out) {
    if (s.basedOn && !ids.has(s.basedOn)) s.basedOn = null
    if (s.basedOn && wouldCycle({ styles: out.filter((x) => x.id !== s.id) }, s.id, s.basedOn)) s.basedOn = null
  }
  return { styles: out }
}

/**
 * 견주기용 한 줄 — 열쇠 차례에 흔들리지 않게 정렬해서 적는다.
 * 그냥 JSON.stringify 로 견주면 같은 한 벌인데도 다르다고 나온다
 * (normalizeProps 가 제 차례로 다시 짓기 때문). 그러면 문서가 안 바뀌었는데도
 * 「바뀌었다」 로 읽혀 저장이 쉼 없이 돈다.
 */
function canonical(sheet: StyleSheet): string {
  return JSON.stringify(
    [...sheet.styles]
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
      .map((s) => [
        s.id, s.name, s.basedOn, s.kind,
        Object.entries(s.props).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      ])
  )
}

export function sameStyleSheet(a: unknown, b: unknown): boolean {
  return canonical(normalizeStyleSheet(a)) === canonical(normalizeStyleSheet(b))
}

/** 새 스타일 — 기준을 골라 만든다 */
export function newStyle(sheet: StyleSheet, name: string, basedOn: string | null, kind: StyleKind = 'paragraph'): NamedStyle {
  let id = `s${Date.now().toString(36)}`
  let n = 0
  while (sheet.styles.some((s) => s.id === id)) { n += 1; id = `s${Date.now().toString(36)}-${n}` }
  return { id, name: name.trim().slice(0, 30) || '새 스타일', basedOn: wouldCycle(sheet, id, basedOn) ? null : basedOn, kind, props: {} }
}
