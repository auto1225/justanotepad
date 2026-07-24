/**
 * Phase 5 — 논문 모드 인용 포맷터.
 * APA 7 / IEEE / MLA 9 세 스타일 지원. CSL JSON 형식의 입력을 받아 문자열로 포맷.
 */
export interface Citation {
  id: string
  type?: 'article' | 'book' | 'web' | 'thesis' | 'conference'
  authors: string[] // ['John Doe', 'Jane Smith']
  year?: string
  title: string
  venue?: string // journal/book/conf name
  volume?: string
  issue?: string
  pages?: string
  publisher?: string
  url?: string
  doi?: string
}

export type CitationStyle = 'apa' | 'ieee' | 'mla' | 'chicago' | 'harvard' | 'vancouver'

export const CITATION_STYLES: ReadonlyArray<{ value: CitationStyle; label: string }> = [
  { value: 'apa', label: 'APA' },
  { value: 'ieee', label: 'IEEE' },
  { value: 'mla', label: 'MLA' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'harvard', label: 'Harvard' },
  { value: 'vancouver', label: 'Vancouver' },
]

/** "First Last" → "Last, F." (Vancouver 는 "Last F") */
function invertName(name: string, dotted = true): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const last = parts.pop() as string
  const initials = parts.map((p) => p[0].toUpperCase() + (dotted ? '.' : '')).join(dotted ? ' ' : '')
  return dotted ? `${last}, ${initials}` : `${last} ${initials}`
}

function authorList(c: Citation, style: CitationStyle): string {
  const a = c.authors.filter(Boolean)
  if (a.length === 0) return ''
  if (style === 'apa') {
    if (a.length === 1) return a[0]
    if (a.length === 2) return `${a[0]} & ${a[1]}`
    if (a.length <= 20) return a.slice(0, -1).join(', ') + ', & ' + a[a.length - 1]
    return a.slice(0, 19).join(', ') + ', ... ' + a[a.length - 1]
  }
  if (style === 'ieee') {
    if (a.length === 1) return a[0]
    if (a.length <= 6) return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]
    return a.slice(0, 6).join(', ') + ', et al.'
  }
  if (style === 'chicago') {
    if (a.length === 1) return a[0]
    if (a.length <= 3) return a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]
    return a[0] + ' et al.'
  }
  if (style === 'harvard') {
    const inv = a.map((x) => invertName(x))
    if (inv.length === 1) return inv[0]
    if (inv.length <= 3) return inv.slice(0, -1).join(', ') + ' and ' + inv[inv.length - 1]
    return inv[0] + ' et al.'
  }
  if (style === 'vancouver') {
    const inv = a.map((x) => invertName(x, false))
    if (inv.length <= 6) return inv.join(', ')
    return inv.slice(0, 6).join(', ') + ', et al.'
  }
  // MLA
  if (a.length === 1) return a[0]
  if (a.length === 2) return `${a[0]} and ${a[1]}`
  return a[0] + ', et al.'
}

export function formatBibEntry(c: Citation, style: CitationStyle, idx?: number): string {
  const a = authorList(c, style)
  const y = c.year || 'n.d.'
  const t = c.title || ''
  const v = c.venue || ''
  const url = c.url ? ` ${c.url}` : ''
  const doi = c.doi ? ` https://doi.org/${c.doi}` : ''

  if (style === 'apa') {
    let s = `${a} (${y}). ${t}.`
    if (v) s += ` ${v}`
    if (c.volume) s += `, ${c.volume}`
    if (c.issue) s += `(${c.issue})`
    if (c.pages) s += `, ${c.pages}`
    if (c.publisher) s += `. ${c.publisher}`
    s += '.'
    return s + doi + url
  }
  if (style === 'ieee') {
    const num = idx != null ? `[${idx + 1}] ` : ''
    let s = `${num}${a}, "${t},"`
    if (v) s += ` in ${v}`
    if (c.volume) s += `, vol. ${c.volume}`
    if (c.issue) s += `, no. ${c.issue}`
    if (c.pages) s += `, pp. ${c.pages}`
    if (y) s += `, ${y}`
    s += '.'
    return s + doi + url
  }
  if (style === 'chicago') {
    let s = `${a}. "${t}."`
    if (v) s += ` ${v}`
    if (c.volume) s += ` ${c.volume}`
    if (c.issue) s += `, no. ${c.issue}`
    s += ` (${y})`
    if (c.pages) s += `: ${c.pages}`
    s += '.'
    return s + doi + url
  }
  if (style === 'harvard') {
    let s = `${a} (${y}) '${t}',`
    if (v) s += ` ${v}`
    if (c.volume) s += `, ${c.volume}`
    if (c.issue) s += `(${c.issue})`
    if (c.pages) s += `, pp. ${c.pages}`
    s += '.'
    return s + doi + url
  }
  if (style === 'vancouver') {
    const num = idx != null ? `${idx + 1}. ` : ''
    let s = `${num}${a}. ${t}.`
    if (v) s += ` ${v}.`
    if (y) s += ` ${y}`
    if (c.volume) s += `;${c.volume}`
    if (c.issue) s += `(${c.issue})`
    if (c.pages) s += `:${c.pages}`
    s += '.'
    return s + doi + url
  }
  // MLA
  let s = `${a}. "${t}."`
  if (v) s += ` ${v},`
  if (c.volume) s += ` vol. ${c.volume},`
  if (c.issue) s += ` no. ${c.issue},`
  if (y) s += ` ${y},`
  if (c.pages) s += ` pp. ${c.pages}`
  s += '.'
  return s + doi + url
}

export function formatInline(c: Citation, style: CitationStyle, idx: number): string {
  if (style === 'ieee' || style === 'vancouver') return `[${idx + 1}]`
  const a = c.authors[0]?.split(' ').pop() || 'Anon'
  if (style === 'apa' || style === 'harvard') return `(${a}, ${c.year || 'n.d.'})`
  if (style === 'chicago') return `(${a} ${c.year || 'n.d.'})`
  return `(${a} ${c.pages || c.year || ''})`.replace(/\s+\)/, ')')
}
