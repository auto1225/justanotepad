import type { Editor } from '@tiptap/react'
import { flash } from './flash'

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
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const level = Number(el.tagName.slice(1))
    const text = (el.textContent || '').trim()
    if (!text || level > maxLevel) return
    out.push({ level, text, page: pageOf(editor, el) })
  })
  return out
}

/** 목차를 넣거나, 이미 있으면 그 자리에서 새로 만든다 (워드 「목차 업데이트」) */
export function putToc(editor: Editor, opts: { maxLevel?: number; pageNumbers?: boolean; title?: string } = {}): boolean {
  const maxLevel = opts.maxLevel ?? 3
  const items = collectHeadings(editor, maxLevel)
  if (!items.length) { flash(`목차로 삼을 제목(H1~H${maxLevel})이 없습니다`); return false }
  const rows = items.map((i) => {
    const dots = opts.pageNumbers === false ? '' : `<span class="jan-toc-page">${i.page || ''}</span>`
    return `<p${field('toc')} data-indent="${Math.min(8, i.level - 1)}" class="jan-toc-row"><a href="#${escAttr(headingAnchor(i.text))}">${esc(i.text)}</a>${dots}</p>`
  }).join('')
  const html = `<p${field('toc')} class="jan-toc-head"><strong>${esc(opts.title || '목차')}</strong></p>${rows}`
  const how = putBlock(editor, 'toc', html)
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
      `<p${field('endnote')} class="jan-en-head"><strong>미주</strong></p>${row}`).run()
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
  const html = `<p${field('bib')} class="jan-bib-head"><strong>참고 문헌</strong></p>${rows}`
  const how = putBlock(editor, 'bib', html)
  flash(how === 'replaced' ? `참고 문헌을 새로 만들었습니다 (${style})` : `참고 문헌 ${sources.length}건을 넣었습니다 (${style})`)
  return true
}

/* ── 캡션 목차 (그림·표 목차) ─────────────────────────── */

export function putCaptionList(editor: Editor, kind: 'figure' | 'table'): boolean {
  if (editor.isDestroyed) return false
  const root = editor.view.dom
  const sel = kind === 'figure' ? '.paper-figcap, [data-paper-block="figcap"]' : '.paper-tabcap, [data-paper-block="tabcap"]'
  const caps = [...root.querySelectorAll(sel)]
  const word = kind === 'figure' ? '그림' : '표'
  if (!caps.length) { flash(`${word} 캡션이 없습니다 — 캡션을 먼저 넣어 주세요`); return false }
  const key = kind === 'figure' ? 'figlist' : 'tablist'
  const rows = caps.map((el, i) =>
    `<p${field(key)} class="jan-toc-row">${word} ${i + 1}. ${esc((el.textContent || '').replace(/^(그림|표)\s*\d+[.:]?\s*/, '').trim())}<span class="jan-toc-page">${pageOf(editor, el) || ''}</span></p>`).join('')
  const html = `<p${field(key)}><strong>${word} 목차</strong></p>${rows}`
  const how = putBlock(editor, key, html)
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
    .map(([term, pages]) => `<p${field('index')} class="jan-index-row">${esc(term)}<span class="jan-toc-page">${[...pages].sort((x, y) => x - y).join(', ')}</span></p>`)
    .join('')
  const html = `<p${field('index')}><strong>색인</strong></p>${rows}`
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
      `<p${field('auth')} class="jan-index-row">${esc(label)}<span class="jan-toc-page">${[...pages].sort((x, y) => x - y).join(', ')}</span></p>`).join('')
  ).join('')
  const html = `<p${field('auth')}><strong>근거 목차</strong></p>${body}`
  const how = putBlock(editor, 'auth', html)
  flash(how === 'replaced' ? '근거 목차를 새로 만들었습니다' : '근거 목차를 만들었습니다')
  return true
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
