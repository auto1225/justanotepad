import type { Editor } from '@tiptap/react'
import { captionWord } from '../extensions/PaperTag'
import { flash } from './flash'
import { outlineLevelOfElement } from './docStyles'

/**
 * 자료 — 워드 「참조」 탭이 하는 일들.
 *
 *   목차(넣기·고쳐 넣기) · 미주 · 출처와 참고 문헌 · 캡션 목차 · 색인 · 근거 목차
 *
 * 워드는 이런 것을 「필드」 로 심어 두고 F9 로 새로 고친다. 우리는 심은 자리에
 * 표시(data-jan-*)를 남겨 두고, 「고쳐 넣기」 를 누르면 그 자리만 다시 만든다 —
 * 사용자가 필드라는 개념을 몰라도 되게.
 */

/* ── 공통 ────────────────────────────────────────────── */

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (v: string) => esc(v).replace(/"/g, '&quot;')

/**
 * 심어 둔 목록이 차지한 자리를 찾는다.
 * 감싸는 div 는 문서 구조에 없어 저장할 때 벗겨지므로, 줄마다 붙인 이름표(janField)로 찾는다.
 */
function findBlock(editor: Editor, kind: string): { from: number; to: number } | null {
  let from = -1
  let to = -1
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs?.janField !== kind) return
    if (from < 0) from = pos
    to = pos + node.nodeSize
  })
  return from >= 0 ? { from, to } : null
}

/** 심은 목록을 새 내용으로 갈아 끼운다 (없으면 커서 자리에 넣는다) */
function putBlock(editor: Editor, kind: string, html: string): 'replaced' | 'inserted' {
  const spot = findBlock(editor, kind)
  if (spot) {
    editor.chain().focus().insertContentAt({ from: spot.from, to: spot.to }, html).run()
    return 'replaced'
  }
  editor.chain().focus().insertContent(html).run()
  return 'inserted'
}

/** 이 목록에 속한 줄임을 알리는 표시 */
const field = (kind: string) => ` data-jan-field="${kind}"`

/**
 * 이 줄이 목록의 「머리글」 이라는 표시.
 *
 * class 는 문서 구조에 없어 저장·재파싱에서 벗겨진다 — 목차 쪽 번호가 제목에 달라붙던 것과
 * 같은 뿌리다. 그래서 참고 문헌·미주의 매달린 들여쓰기를 «머리글만 빼고» 걸려면
 * 살아남는 속성이 하나 더 있어야 한다. 「고쳐야 함」 알림도 이 줄에 붙는다.
 */
const headRole = ' data-jan-field-role="head"'

/**
 * 오른쪽 끝 쪽 칸 — 반드시 janFieldPage 노드로 넣는다.
 * <span class="jan-toc-page"> 는 문서 구조에 없어 저장할 때 벗겨지고,
 * 그러면 번호가 제목 글에 그대로 달라붙는다 («제1장 제목5»).
 */
const pageCell = (label: string | number) => `<span data-jan-page-num="1">${esc(String(label ?? ''))}</span>`

/**
 * 심어 둔 목록의 쪽 칸을 지금 쪽으로 고쳐 쓴다 — 목차 자신이 만든 오차를 지우는 두 번째 걸음.
 *
 * 쪽 번호는 목록을 넣기 「전」 화면에서 읽는다. 그런데 목록이 차지한 만큼 뒤가 밀리므로,
 * 목차를 문서 앞에 넣으면 열여섯 제목 가운데 열다섯이 한 쪽씩 어긋났다.
 * 그래서 쪽 나눔이 앉기를 기다렸다가 번호만 다시 적는다. attrs 만 바꾸므로
 * 문서 크기가 그대로여서 쪽이 다시 흔들리지 않는다 (되돌리기에도 남기지 않는다).
 */
function fixPagesWhenSettled(editor: Editor, kind: string, pagesNow: () => Array<string | number>): void {
  let 지난모양 = ''
  let 남은횟수 = 24
  const 한걸음 = () => {
    if (editor.isDestroyed) return
    const 모양 = `${editor.view.dom.querySelectorAll('[data-jan-page]').length}|${editor.state.doc.content.size}`
    if (모양 !== 지난모양 && 남은횟수-- > 0) {   // 아직 쪽이 움직인다 — 더 기다린다
      지난모양 = 모양
      window.setTimeout(한걸음, 250)
      return
    }
    const 쪽들 = pagesNow()
    const 칸들: Array<{ pos: number; text: string }> = []
    editor.state.doc.descendants((node, pos, parent) => {
      if (node.type.name !== 'janFieldPage') return
      if (parent?.attrs?.janField !== kind) return
      칸들.push({ pos, text: String(node.attrs.text ?? '') })
    })
    if (칸들.length !== 쪽들.length) return  // 그 사이 문서가 달라졌다 — 손대지 않는다
    let tr = null as null | ReturnType<typeof editor.state.tr.setNodeMarkup>
    칸들.forEach((칸, i) => {
      const next = String(쪽들[i] ?? '')
      if (next === 칸.text) return
      const node = editor.state.doc.nodeAt(칸.pos)
      if (!node) return
      tr = (tr ?? editor.state.tr).setNodeMarkup(칸.pos, undefined, { ...node.attrs, text: next })
    })
    if (!tr) return
    ;(tr as { setMeta: (k: string, v: unknown) => void }).setMeta('addToHistory', false)
    editor.view.dispatch(tr)
  }
  window.setTimeout(한걸음, 250)
}

/** 제목 글에서 이어 쓸 수 있는 앵커 이름 */
export function headingAnchor(text: string): string {
  return 'h-' + text.trim().toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

/** 어느 쪽에 있는지 (독립 페이지 모델에서만 뜻이 있다) */
function pageOf(editor: Editor, el: Element): number {
  const page = el.closest('[data-jan-page]')
  if (!page) return 0
  const pages = [...editor.view.dom.querySelectorAll('[data-jan-page]')]
  return pages.indexOf(page) + 1
}

/* ── 목차 ────────────────────────────────────────────── */

export interface TocEntry { level: number; text: string; page: number }

export function collectHeadings(editor: Editor, maxLevel = 3): TocEntry[] {
  const out: TocEntry[] = []
  const root = editor.view.dom
  /* 태그만 보지 않는다 — 스타일로 「제목1」 을 붙인 문단도 제목이고, h1 에 「바탕글」 을
     붙였으면 제목이 아니다. 그래서 문단까지 훑어 개요 수준으로 가른다.
     목차 줄 자신은 개요 수준 0(바탕글에서 물려받음)이라 제 목차에 다시 잡히지 않는다. */
  root.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach((el) => {
    const level = outlineLevelOfElement(el)
    const text = (el.textContent || '').trim()
    if (!text || level < 1 || level > maxLevel) return
    out.push({ level, text, page: pageOf(editor, el) })
  })
  return out
}

/** 목차를 넣거나, 이미 있으면 그 자리에서 새로 만든다 (워드 「목차 업데이트」) */
export function putToc(editor: Editor, opts: { maxLevel?: number; pageNumbers?: boolean; title?: string } = {}): boolean {
  const maxLevel = opts.maxLevel ?? 3
  const items = collectHeadings(editor, maxLevel)
  if (!items.length) { flash(`목차로 삼을 제목(H1~H${maxLevel})이 없습니다`); return false }
  const 쪽보임 = opts.pageNumbers !== false
  const rows = items.map((i) => {
    const dots = 쪽보임 ? pageCell(i.page || '') : ''
    /* 목차 줄에도 스타일 이름표를 붙인다 — toc1·toc2·toc3 정의를 고치면 이미 넣어 둔
       목차도 함께 바뀐다 (data-indent 는 조판이 쓰므로 그대로 둔다) */
    return `<p${field('toc')} data-jan-style="toc${Math.min(3, i.level)}" data-indent="${Math.min(8, i.level - 1)}" class="jan-toc-row"><a href="#${escAttr(headingAnchor(i.text))}">${esc(i.text)}</a>${dots}</p>`
  }).join('')
  const html = `<p${field('toc')}${headRole} class="jan-toc-head"><strong>${esc(opts.title || '목차')}</strong></p>${rows}`
  const how = putBlock(editor, 'toc', html)
  /* 목차가 밀어낸 만큼 쪽이 달라진다 — 앉은 뒤에 번호만 다시 적는다 */
  if (쪽보임) fixPagesWhenSettled(editor, 'toc', () => collectHeadings(editor, maxLevel).map((i) => i.page || ''))
  flash(how === 'replaced' ? `목차를 새로 만들었습니다 (${items.length}개)` : `제목 ${items.length}개로 목차를 만들었습니다`)
  return true
}

/** 이 문단을 목차에 넣는다 — 워드 「텍스트 추가」 (제목 수준으로 올린다) */
export function addToToc(editor: Editor, level: number): boolean {
  const ok = editor.chain().focus().setNode('heading', { level }).run()
  flash(ok ? `이 문단을 목차 ${level}수준으로 올렸습니다` : '이 자리는 목차에 넣을 수 없습니다')
  return ok
}

/* ── 미주 ────────────────────────────────────────────── */

const ROMAN = ['ⅰ', 'ⅱ', 'ⅲ', 'ⅳ', 'ⅴ', 'ⅵ', 'ⅶ', 'ⅷ', 'ⅹ', 'ⅹ']
const roman = (n: number) => ROMAN[n - 1] || `(${n})`

/** 미주 넣기 — 각주는 쪽 아래, 미주는 문서 끝에 모인다 (워드와 같다) */
export function insertEndnote(editor: Editor): number {
  const root = editor.view.dom
  const n = root.querySelectorAll('.jan-en-ref').length + 1
  const mark = `<sup class="jan-en-ref" data-en="${n}"><a href="#jan-en-${n}">${roman(n)}</a></sup>`
  editor.chain().focus().insertContent(mark).run()

  // 문서 끝의 미주 모음 — 없으면 머리글부터 만든다
  const spot = findBlock(editor, 'endnote')
  const row = `<p${field('endnote')} class="jan-en-item" id="jan-en-${n}"><sup class="jan-en-num">${roman(n)}</sup> 미주 내용을 적는다</p>`
  if (spot) {
    editor.chain().insertContentAt(spot.to, row).run()
  } else {
    const end = editor.state.doc.content.size
    editor.chain().insertContentAt(Math.max(1, end - 1),
      `<p${field('endnote')}${headRole} class="jan-en-head"><strong>미주</strong></p>${row}`).run()
  }
  flash(`미주 ${roman(n)} 을 넣었습니다 — 문서 끝에 모입니다`)
  return n
}

/** 다음 각주·미주 표식으로 커서를 옮긴다 (워드 「다음 각주」) */
export function gotoNextNote(editor: Editor, kind: 'footnote' | 'endnote' = 'footnote'): boolean {
  const cls = kind === 'endnote' ? '.jan-en-ref' : '.paper-fn-ref'
  const marks = [...editor.view.dom.querySelectorAll(cls)]
  if (!marks.length) { flash(kind === 'endnote' ? '미주가 없습니다' : '각주가 없습니다'); return false }
  const here = editor.state.selection.from
  for (const el of marks) {
    try {
      const pos = editor.view.posAtDOM(el, 0)
      if (pos > here + 1) {
        editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
        return true
      }
    } catch { /* 못 찾으면 다음 것으로 */ }
  }
  // 끝까지 갔으면 처음으로 돈다
  try {
    const pos = editor.view.posAtDOM(marks[0], 0)
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
    flash('처음 주석으로 돌아갔습니다')
    return true
  } catch {
    return false
  }
}

/** 각주·미주가 모인 자리로 간다 (워드 「각주/미주 표시」) */
export function gotoNoteArea(editor: Editor, kind: 'footnote' | 'endnote' = 'endnote'): boolean {
  const sel = kind === 'endnote' ? '[data-jan-field="endnote"]' : '.paper-fn-body'
  const el = editor.view.dom.querySelector(sel)
  if (!el) { flash(kind === 'endnote' ? '미주가 없습니다' : '각주가 없습니다'); return false }
  el.scrollIntoView({ block: 'center' })
  try {
    editor.chain().focus().setTextSelection(editor.view.posAtDOM(el, 0)).run()
  } catch { /* 자리만 보여 주면 된다 */ }
  return true
}

/* ── 출처와 참고 문헌 ─────────────────────────────────── */

export type SourceType = 'book' | 'journal' | 'web' | 'report' | 'thesis' | 'conference'

export interface Source {
  id: string
  type: SourceType
  authors: string
  title: string
  year: string
  container: string
  publisher: string
  volume: string
  pages: string
  url: string
  accessed: string
}

export const SOURCE_TYPES: Array<{ key: SourceType; label: string }> = [
  { key: 'journal', label: '학술지 논문' },
  { key: 'book', label: '책' },
  { key: 'conference', label: '학술대회 발표' },
  { key: 'thesis', label: '학위 논문' },
  { key: 'report', label: '보고서' },
  { key: 'web', label: '웹 문서' },
]

export const CITE_STYLES = ['APA', 'MLA', 'Chicago', 'IEEE', 'KCI'] as const
export type CiteStyle = typeof CITE_STYLES[number]

const SOURCE_KEY = 'jan-v2-sources'
const STYLE_KEY = 'jan-v2-cite-style'

export function loadSources(): Source[] {
  try {
    const raw = localStorage.getItem(SOURCE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveSources(list: Source[]): void {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify(list.slice(0, 500))) } catch { /* 저장이 막혀도 이 세션은 쓴다 */ }
}

export function citeStyle(): CiteStyle {
  try {
    const v = localStorage.getItem(STYLE_KEY)
    return (CITE_STYLES as readonly string[]).includes(v || '') ? (v as CiteStyle) : 'APA'
  } catch {
    return 'APA'
  }
}

export function setCiteStyle(style: CiteStyle): void {
  try { localStorage.setItem(STYLE_KEY, style) } catch { /* 무시 */ }
}

export function newSource(): Source {
  return {
    id: 's' + Math.random().toString(36).slice(2, 9),
    type: 'journal', authors: '', title: '', year: '', container: '',
    publisher: '', volume: '', pages: '', url: '', accessed: '',
  }
}

/** 첫 저자의 성 — 정렬과 본문 인용에 쓴다 */
function firstAuthor(s: Source): string {
  const first = s.authors.split(/[,;·]/)[0]?.trim() || s.title
  return first
}

/** 본문에 넣는 인용 표기 */
export function citationText(s: Source, style: CiteStyle): string {
  const who = firstAuthor(s)
  const year = s.year || 'n.d.'
  switch (style) {
    case 'MLA': return `(${who} ${s.pages || ''})`.replace(' )', ')')
    case 'Chicago': return `(${who} ${year})`
    case 'IEEE': return '[?]'                    // 번호는 참고 문헌 목록을 만들 때 매긴다
    case 'KCI': return `(${who}, ${year})`
    default: return `(${who}, ${year})`
  }
}

/** 참고 문헌 한 줄 */
export function referenceText(s: Source, style: CiteStyle, index = 1): string {
  const A = s.authors || '작성자 미상'
  const T = s.title || '제목 없음'
  const Y = s.year || 'n.d.'
  const C = s.container
  const P = s.publisher
  const V = s.volume
  const G = s.pages
  const U = s.url ? ` ${s.url}` : ''
  switch (style) {
    case 'MLA':
      return `${A}. "${T}." ${C ? C + ', ' : ''}${V ? V + ', ' : ''}${Y}${G ? ', pp. ' + G : ''}.${U}`
    case 'Chicago':
      return `${A}. ${Y}. "${T}." ${C ? C + ' ' : ''}${V ? V + ': ' : ''}${G || ''}.${P ? ' ' + P + '.' : ''}${U}`
    case 'IEEE':
      return `[${index}] ${A}, "${T}," ${C ? C + ', ' : ''}${V ? 'vol. ' + V + ', ' : ''}${G ? 'pp. ' + G + ', ' : ''}${Y}.${U}`
    case 'KCI':
      return `${A} (${Y}). ${T}. ${C ? C : P}${V ? ', ' + V : ''}${G ? ', ' + G : ''}.${U}`
    default: // APA
      return `${A} (${Y}). ${T}. ${C ? C : P}${V ? ', ' + V : ''}${G ? ', ' + G : ''}.${U}`
  }
}

/** 참고 문헌 목록을 넣거나 그 자리에서 새로 만든다 */
export function putBibliography(editor: Editor, sources: Source[], style: CiteStyle): boolean {
  if (!sources.length) { flash('출처가 아직 없습니다 — 「출처 관리」 에서 먼저 넣어 주세요'); return false }
  const sorted = style === 'IEEE' ? sources : [...sources].sort((a, b) => firstAuthor(a).localeCompare(firstAuthor(b), 'ko'))
  const rows = sorted.map((s, i) =>
    `<p${field('bib')} class="jan-ref-item">${esc(referenceText(s, style, i + 1))}</p>`).join('')
  const html = `<p${field('bib')}${headRole} class="jan-bib-head"><strong>참고 문헌</strong></p>${rows}`
  const how = putBlock(editor, 'bib', html)
  flash(how === 'replaced' ? `참고 문헌을 새로 만들었습니다 (${style})` : `참고 문헌 ${sources.length}건을 넣었습니다 (${style})`)
  return true
}

/* ── 캡션 목차 (그림·표 목차) ─────────────────────────── */

/**
 * 캡션 줄에서 설명만 뽑는다.
 *
 * 캡션은 «Fig. 1. 첫째 그림» 이다 — 앞의 라벨은 paperTag 노드가 그린 글이라 글자열로
 * 벗기려 하면 («그림|표 n.» 을 찾는 정규식이라) 하나도 걸리지 않아 «그림 1. Fig. 1. 첫째 그림»
 * 처럼 번호가 두 번 적혔다. 라벨 노드 자체를 떼어 내면 라벨 모양이 무엇이든 정확히 벗겨진다.
 */
function captionText(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('[data-paper-tag], [data-jan-page-num]').forEach((tag) => tag.remove())
  return (copy.textContent || '').replace(/^(그림|표|Fig\.?|Table)\s*\d+\s*[.:]?\s*/i, '').trim()
}

/**
 * 이 캡션이 스스로 쓴 이름 — «그림 1.» · «Fig. 1.».
 * 목록이 제 낱말을 따로 지어 적으면 캡션은 「Fig. 1.」 인데 목차는 「그림 1.」 이 되어
 * 한 문서에 이름이 두 가지가 된다. 그래서 라벨 노드가 그린 글을 그대로 옮겨 적는다.
 */
function captionMark(el: Element, fallbackWord: string, n: number): string {
  const tag = el.querySelector('[data-paper-tag]')
  const text = (tag?.textContent || '').trim()
  return text || `${fallbackWord} ${n}.`
}

export function putCaptionList(editor: Editor, kind: 'figure' | 'table'): boolean {
  if (editor.isDestroyed) return false
  const root = editor.view.dom
  const sel = kind === 'figure' ? '.paper-figcap, [data-paper-block="figcap"]' : '.paper-tabcap, [data-paper-block="tabcap"]'
  const caps = [...root.querySelectorAll(sel)]
  const word = captionWord(kind === 'figure' ? 'figlabel' : 'tablabel', null)
  if (!caps.length) { flash(`${word} 캡션이 없습니다 — 캡션을 먼저 넣어 주세요`); return false }
  const key = kind === 'figure' ? 'figlist' : 'tablist'
  const rows = caps.map((el, i) =>
    `<p${field(key)} class="jan-toc-row">${esc(captionMark(el, word, i + 1))} ${esc(captionText(el))}${pageCell(pageOf(editor, el) || '')}</p>`).join('')
  const html = `<p${field(key)}${headRole} class="jan-toc-head"><strong>${word} 목차</strong></p>${rows}`
  const how = putBlock(editor, key, html)
  fixPagesWhenSettled(editor, key, () =>
    [...editor.view.dom.querySelectorAll(sel)].map((el) => pageOf(editor, el) || ''))
  flash(how === 'replaced' ? `${word} 목차를 새로 만들었습니다` : `${word} ${caps.length}개로 목차를 만들었습니다`)
  return true
}

/* ── 색인 ────────────────────────────────────────────── */

/** 고른 말을 색인 항목으로 표시한다 (워드 「항목 표시」) */
export function markIndexEntry(editor: Editor, term: string): boolean {
  const word = term.trim()
  if (!word) return false
  const { from, to } = editor.state.selection
  if (from === to) {
    // 고른 글이 없으면 그 말을 적어 넣고 거기에 표시를 단다
    editor.chain().focus().insertContent(word).setTextSelection({ from, to: from + word.length })
      .setIndexEntry(word).setTextSelection(from + word.length).run()
  } else {
    editor.chain().focus().setIndexEntry(word).run()
  }
  flash(`색인에 「${word}」 를 넣었습니다`)
  return true
}

export function putIndex(editor: Editor): boolean {
  const marks = [...editor.view.dom.querySelectorAll('[data-index]')]
  if (!marks.length) { flash('색인 항목이 없습니다 — 먼저 「항목 표시」 로 표시해 주세요'); return false }
  const map = new Map<string, Set<number>>()
  marks.forEach((el) => {
    const term = el.getAttribute('data-index') || ''
    if (!term) return
    const page = pageOf(editor, el)
    if (!map.has(term)) map.set(term, new Set())
    if (page) map.get(term)!.add(page)
  })
  const rows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
    .map(([term, pages]) => `<p${field('index')} class="jan-index-row">${esc(term)}${pageCell([...pages].sort((x, y) => x - y).join(', '))}</p>`)
    .join('')
  const html = `<p${field('index')}${headRole}><strong>색인</strong></p>${rows}`
  const how = putBlock(editor, 'index', html)
  flash(how === 'replaced' ? '색인을 새로 만들었습니다' : `색인 ${map.size}항목을 만들었습니다`)
  return true
}

/* ── 근거 목차 (법령·판례) ────────────────────────────── */

export const AUTHORITY_KINDS = ['법령', '판례', '고시·규칙', '조약', '기타'] as const
export type AuthorityKind = typeof AUTHORITY_KINDS[number]

/** 고른 글을 근거(법령·판례)로 표시한다 (워드 「인용 표시」) */
export function markAuthority(editor: Editor, kind: AuthorityKind, text: string): boolean {
  const label = text.trim()
  if (!label) return false
  const { from, to } = editor.state.selection
  if (from === to) {
    editor.chain().focus().insertContent(label).setTextSelection({ from, to: from + label.length })
      .setAuthority(label, kind).setTextSelection(from + label.length).run()
  } else {
    editor.chain().focus().setAuthority(label, kind).run()
  }
  flash(`${kind} 근거로 「${label}」 을 표시했습니다`)
  return true
}

export function putAuthorityList(editor: Editor): boolean {
  const marks = [...editor.view.dom.querySelectorAll('[data-authority]')]
  if (!marks.length) { flash('표시한 근거가 없습니다 — 먼저 「근거 표시」 를 해 주세요'); return false }
  const byKind = new Map<string, Map<string, Set<number>>>()
  marks.forEach((el) => {
    const kind = el.getAttribute('data-auth-kind') || '기타'
    const label = el.getAttribute('data-authority') || ''
    if (!label) return
    if (!byKind.has(kind)) byKind.set(kind, new Map())
    const inner = byKind.get(kind)!
    if (!inner.has(label)) inner.set(label, new Set())
    const page = pageOf(editor, el)
    if (page) inner.get(label)!.add(page)
  })
  const body = [...byKind.entries()].map(([kind, items]) =>
    `<p${field('auth')} class="jan-auth-kind"><strong>${esc(kind)}</strong></p>` +
    [...items.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko')).map(([label, pages]) =>
      `<p${field('auth')} class="jan-index-row">${esc(label)}${pageCell([...pages].sort((x, y) => x - y).join(', '))}</p>`).join('')
  ).join('')
  const html = `<p${field('auth')}${headRole}><strong>근거 목차</strong></p>${body}`
  const how = putBlock(editor, 'auth', html)
  flash(how === 'replaced' ? '근거 목차를 새로 만들었습니다' : '근거 목차를 만들었습니다')
  return true
}

/* ── 심어 둔 목록이 스스로 따라가게 ───────────────────── */

/**
 * 지금 문서가 말하는 「이 목록에 들어가야 할 것」 — 줄마다 (이름, 쪽) 한 쌍.
 *
 * 목록을 만들 때 쓴 것과 같은 셈을 쓴다. 다르게 세면 멀쩡한 목록을 「어긋났다」 고 잘못 알린다.
 */
function fieldEntries(editor: Editor, kind: string): Array<{ name: string; page: string }> | null {
  const root = editor.view.dom
  const 쪽글 = (el: Element) => String(pageOf(editor, el) || '')
  if (kind === 'toc') {
    return collectHeadings(editor).map((i) => ({ name: i.text, page: String(i.page || '') }))
  }
  if (kind === 'figlist' || kind === 'tablist') {
    const sel = kind === 'figlist'
      ? '.paper-figcap, [data-paper-block="figcap"]'
      : '.paper-tabcap, [data-paper-block="tabcap"]'
    const word = captionWord(kind === 'figlist' ? 'figlabel' : 'tablabel', null)
    return [...root.querySelectorAll(sel)].map((el, i) => ({
      name: `${captionMark(el, word, i + 1)} ${captionText(el)}`.trim(),
      page: 쪽글(el),
    }))
  }
  if (kind === 'index') {
    const map = new Map<string, Set<number>>()
    root.querySelectorAll('[data-index]').forEach((el) => {
      const term = el.getAttribute('data-index') || ''
      if (!term) return
      if (!map.has(term)) map.set(term, new Set())
      const page = pageOf(editor, el)
      if (page) map.get(term)!.add(page)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([term, pages]) => ({ name: term, page: [...pages].sort((x, y) => x - y).join(', ') }))
  }
  if (kind === 'auth') {
    const byKind = new Map<string, Map<string, Set<number>>>()
    root.querySelectorAll('[data-authority]').forEach((el) => {
      const k = el.getAttribute('data-auth-kind') || '기타'
      const label = el.getAttribute('data-authority') || ''
      if (!label) return
      if (!byKind.has(k)) byKind.set(k, new Map())
      const inner = byKind.get(k)!
      if (!inner.has(label)) inner.set(label, new Set())
      const page = pageOf(editor, el)
      if (page) inner.get(label)!.add(page)
    })
    /* 갈래 머리글에는 쪽 칸이 없다 — 쪽 칸을 가진 줄만 센다 */
    return [...byKind.values()].flatMap((items) =>
      [...items.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
        .map(([label, pages]) => ({ name: label, page: [...pages].sort((x, y) => x - y).join(', ') })))
  }
  return null // 참고 문헌·미주는 쪽 칸이 없다
}

interface FieldSpot {
  cells: Array<{ pos: number; text: string; row: string }>
  head: number
  stale: string | null
}

/**
 * 심어 둔 목록이 지금 차지하고 있는 자리 — 갈래마다 머리글 위치와 쪽 칸들.
 * 문서를 한 번만 훑는다 (갈래마다 훑으면 긴 문서에서 헛일이 다섯 배가 된다).
 */
function fieldSpots(editor: Editor): Map<string, FieldSpot> {
  const out = new Map<string, FieldSpot>()
  const 자리 = (kind: string) => {
    let spot = out.get(kind)
    if (!spot) { spot = { cells: [], head: -1, stale: null }; out.set(kind, spot) }
    return spot
  }
  editor.state.doc.descendants((node, pos, parent) => {
    const kind = node.attrs?.janField as string | undefined
    if (kind && node.attrs?.janFieldRole === 'head') {
      const spot = 자리(kind)
      if (spot.head < 0) {
        spot.head = pos
        spot.stale = (node.attrs.janStale as string | null) ?? null
      }
    }
    if (node.type.name !== 'janFieldPage') return
    const owner = parent?.attrs?.janField as string | undefined
    if (!owner) return
    /* 쪽 칸은 알맹이가 attrs 에만 있으므로 줄 글에는 섞이지 않는다 — 이름만 견주게 된다 */
    자리(owner).cells.push({ pos, text: String(node.attrs.text ?? ''), row: (parent!.textContent || '').trim() })
  })
  return out
}

/** 「고쳐야 함」 표시를 켜거나 끈다 (attrs 만 바꾼다 — 되돌리기에도 남기지 않는다) */
function markStale(editor: Editor, head: number, want: string | null, now: string | null): boolean {
  if (head < 0 || want === now) return false
  const node = editor.state.doc.nodeAt(head)
  if (!node) return false
  const tr = editor.state.tr.setNodeMarkup(head, undefined, { ...node.attrs, janStale: want })
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return true
}

/**
 * 심어 둔 목록을 지금 문서에 맞춘다 — 워드의 F9 를 사람 대신 눌러 주는 자리.
 *
 * 두 가지를 나눠 다룬다.
 *  쪽 번호는 스스로 고친다. attrs 만 바꾸므로 문서 크기가 그대로여서 쪽 나눔이 다시 흔들리지
 *    않고, 되돌리기에도 남지 않는다 — 글이 밀려 제목이 다른 쪽으로 가도 목차가 따라간다.
 *  줄이 늘거나 이름이 바뀐 것은 고치지 않고 「고쳐야 함」 으로 알린다. 줄을 다시 만드는 일은
 *    문서 크기를 바꾸는 일이라 조용히 할 수 없다 (되돌리기가 더럽혀지고 쪽이 다시 흔들린다).
 *
 * 반환: 손댄 목록 수
 */
export function syncFieldPages(editor: Editor): number {
  if (editor.isDestroyed) return 0
  const spots = fieldSpots(editor)
  let touched = 0
  for (const kind of ['toc', 'figlist', 'tablist', 'index', 'auth']) {
    const spot = spots.get(kind)
    if (!spot) continue
    const { cells, head, stale } = spot
    const want = fieldEntries(editor, kind)
    if (!want) continue
    if (want.length !== cells.length) {
      if (markStale(editor, head, '1', stale)) touched++
      continue
    }
    /* 줄 글이 달라졌으면(제목 이름이 바뀌었다) 쪽만 고쳐서는 맞지 않는다 */
    const 이름다름 = want.some((w, i) => !cells[i].row.startsWith(w.name.slice(0, 24)))
    if (이름다름) {
      if (markStale(editor, head, '1', stale)) touched++
      continue
    }
    let tr = null as null | ReturnType<typeof editor.state.tr.setNodeMarkup>
    cells.forEach((칸, i) => {
      const next = want[i].page
      if (next === 칸.text) return
      const node = editor.state.doc.nodeAt(칸.pos)
      if (!node) return
      tr = (tr ?? editor.state.tr).setNodeMarkup(칸.pos, undefined, { ...node.attrs, text: next })
    })
    if (tr) {
      ;(tr as { setMeta: (k: string, v: unknown) => void }).setMeta('addToHistory', false)
      editor.view.dispatch(tr)
      touched++
    }
    if (markStale(editor, head, null, stale)) touched++
  }
  return touched
}

/**
 * 문서가 바뀌면 심어 둔 목록을 스스로 맞춘다.
 *
 * 캡션 번호가 그러하듯 목차 쪽 번호도 사람 손에 맡길 자리가 아니다 — 「고쳐 넣기」 를 잊으면
 * 5쪽이라 적힌 제목이 7쪽에 있다. 쪽 나눔이 앉기를 기다렸다가(잇달아 바뀌는 동안은 미룬다)
 * 한 번만 맞춘다.
 */
export function watchFieldPages(editor: Editor, waitMs = 700): () => void {
  let timer: number | undefined
  let inFlight = false
  let 지난모양 = ''

  const 한걸음 = () => {
    if (editor.isDestroyed || inFlight) return
    const 모양 = `${editor.view.dom.querySelectorAll('[data-jan-page]').length}|${editor.state.doc.content.size}`
    if (모양 !== 지난모양) {           // 아직 쪽이 움직인다 — 앉을 때까지 미룬다
      지난모양 = 모양
      timer = window.setTimeout(한걸음, waitMs)
      return
    }
    inFlight = true
    try { syncFieldPages(editor) } finally { inFlight = false }
  }

  const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    if (!transaction.docChanged || inFlight) return
    window.clearTimeout(timer)
    timer = window.setTimeout(한걸음, waitMs)
  }

  editor.on('transaction', onTransaction)
  return () => {
    window.clearTimeout(timer)
    editor.off('transaction', onTransaction)
  }
}

/** 심어 둔 목록을 모두 새로 만든다 — 워드에서 F9 를 여러 번 누르는 일 */
export function refreshAllFields(editor: Editor, sources: Source[], style: CiteStyle): number {
  let done = 0
  const has = (kind: string) => {
    let found = false
    editor.state.doc.descendants((node) => { if (node.attrs?.janField === kind) found = true })
    return found
  }
  if (has('toc')) { putToc(editor); done++ }
  if (has('figlist')) { putCaptionList(editor, 'figure'); done++ }
  if (has('tablist')) { putCaptionList(editor, 'table'); done++ }
  if (has('index')) { putIndex(editor); done++ }
  if (has('auth')) { putAuthorityList(editor); done++ }
  if (has('bib')) { putBibliography(editor, sources, style); done++ }
  flash(done ? `${done}개 목록을 새로 만들었습니다` : '새로 만들 목록이 없습니다')
  return done
}
