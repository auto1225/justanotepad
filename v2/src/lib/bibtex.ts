import type { Citation } from './citationFormat'

/**
 * BibTeX 가져오기/내보내기.
 * 파서는 실전 .bib 의 95%를 차지하는 형태를 지원:
 *   @type{key, field = {값}, field = "값", field = 숫자, ...}
 * 중첩 중괄호({{...}} 포함)와 트레일링 콤마를 허용한다.
 */

export interface BibEntry {
  type: string
  key: string
  fields: Record<string, string>
}

export function parseBibtex(src: string): BibEntry[] {
  const out: BibEntry[] = []
  let i = 0
  const n = src.length
  while (i < n) {
    const at = src.indexOf('@', i)
    if (at < 0) break
    i = at + 1
    // 엔트리 타입
    let j = i
    while (j < n && /[a-zA-Z]/.test(src[j])) j++
    const type = src.slice(i, j).toLowerCase()
    while (j < n && /\s/.test(src[j])) j++
    if (src[j] !== '{' || !type) { i = j + 1; continue }
    if (type === 'comment' || type === 'preamble' || type === 'string') { i = j + 1; continue }
    j++
    // 키
    let k = j
    while (k < n && src[k] !== ',' && src[k] !== '}') k++
    const key = src.slice(j, k).trim()
    if (src[k] === '}') { i = k + 1; continue }
    j = k + 1
    // 필드들
    const fields: Record<string, string> = {}
    while (j < n) {
      while (j < n && /[\s,]/.test(src[j])) j++
      if (src[j] === '}') { j++; break }
      let f = j
      while (f < n && /[a-zA-Z_-]/.test(src[f])) f++
      const name = src.slice(j, f).toLowerCase().trim()
      while (f < n && /\s/.test(src[f])) f++
      if (src[f] !== '=') { j = f + 1; continue }
      f++
      while (f < n && /\s/.test(src[f])) f++
      let value: string
      if (src[f] === '{') {
        let depth = 1; f++
        const start = f
        while (f < n && depth > 0) {
          if (src[f] === '{') depth++
          else if (src[f] === '}') depth--
          f++
        }
        value = src.slice(start, f - 1)
      } else if (src[f] === '"') {
        f++
        const start = f
        while (f < n && src[f] !== '"') f++
        value = src.slice(start, f)
        f++
      } else {
        const start = f
        while (f < n && src[f] !== ',' && src[f] !== '}') f++
        value = src.slice(start, f)
      }
      if (name) fields[name] = cleanBibValue(value)
      j = f
    }
    if (key || Object.keys(fields).length) out.push({ type, key, fields })
    i = j
  }
  return out
}

function cleanBibValue(v: string): string {
  return v
    .replace(/[{}]/g, '')
    .replace(/\\['"`^~=.]/g, '')
    .replace(/\\([a-zA-Z]+)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** BibTeX author 필드("A and B and C", "Last, First") → 표시 이름 배열 */
export function parseBibAuthors(field: string): string[] {
  return field
    .split(/\s+and\s+/i)
    .map((a) => {
      const t = a.trim()
      if (t.includes(',')) {
        const [last, first] = t.split(',').map((s) => s.trim())
        return [first, last].filter(Boolean).join(' ')
      }
      return t
    })
    .filter(Boolean)
}

export function bibEntryToCitation(e: BibEntry): Citation {
  const f = e.fields
  const type = e.type === 'book' ? 'book'
    : e.type === 'inproceedings' || e.type === 'conference' ? 'conference'
    : e.type === 'phdthesis' || e.type === 'mastersthesis' ? 'thesis'
    : e.type === 'misc' && f.url ? 'web'
    : 'article'
  return {
    id: '',
    type,
    authors: f.author ? parseBibAuthors(f.author) : [''],
    title: f.title || '',
    year: (f.year || '').replace(/\D/g, '').slice(0, 4),
    venue: f.journal || f.booktitle || f.school || f.publisher || '',
    volume: f.volume || '',
    issue: f.number || '',
    pages: (f.pages || '').replace(/--/g, '-'),
    publisher: f.publisher || '',
    doi: f.doi || '',
    url: f.url || '',
  }
}

function bibKey(c: Citation, idx: number): string {
  const last = (c.authors[0] || 'anon').split(' ').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon'
  return `${last}${c.year || ''}${idx > 0 ? String.fromCharCode(97 + idx) : ''}`
}

/** 인용 목록 → BibTeX 텍스트 */
export function citationsToBibtex(cites: Citation[]): string {
  return cites
    .map((c, i) => {
      const type = c.type === 'book' ? 'book' : c.type === 'conference' ? 'inproceedings' : c.type === 'thesis' ? 'phdthesis' : 'article'
      const lines: string[] = []
      if (c.authors.filter(Boolean).length) lines.push(`  author = {${c.authors.filter(Boolean).join(' and ')}}`)
      if (c.title) lines.push(`  title = {${c.title}}`)
      const venueField = type === 'inproceedings' ? 'booktitle' : type === 'phdthesis' ? 'school' : 'journal'
      if (c.venue) lines.push(`  ${venueField} = {${c.venue}}`)
      if (c.year) lines.push(`  year = {${c.year}}`)
      if (c.volume) lines.push(`  volume = {${c.volume}}`)
      if (c.issue) lines.push(`  number = {${c.issue}}`)
      if (c.pages) lines.push(`  pages = {${c.pages.replace(/-/g, '--')}}`)
      if (c.publisher && venueField !== 'journal') lines.push(`  publisher = {${c.publisher}}`)
      if (c.doi) lines.push(`  doi = {${c.doi}}`)
      if (c.url) lines.push(`  url = {${c.url}}`)
      return `@${type}{${bibKey(c, i)},\n${lines.join(',\n')}\n}`
    })
    .join('\n\n')
}
