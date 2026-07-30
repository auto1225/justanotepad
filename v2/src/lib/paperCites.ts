import { bibEntryToCitation, citationsToBibtex, parseBibtex } from './bibtex'
import type { Citation, CitationStyle } from './citationFormat'
import { useSettingsStore } from '../store/settingsStore'
import { flash } from './flash'

/**
 * 학술 인용 목록 — 논문 탭과 인용 관리 창이 함께 쓰는 자리.
 *
 * 자료 탭의 「출처 관리」 는 손으로 적어 넣는 밑자료이고, 이쪽은 DOI·BibTeX 로 불러오는
 * 학술 인용이다. 둘은 쓰는 곳이 달라 목록도 따로 둔다 (섞으면 서식이 어긋난다).
 */

const KEY = 'jan-v2-citations'

export function loadCitations(): Citation[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveCitations(list: Citation[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* 저장 못 해도 이번 판은 쓴다 */ }
}

export function citationStyle(): CitationStyle {
  return useSettingsStore.getState().citationStyle
}

export function setCitationStyle(style: CitationStyle) {
  useSettingsStore.getState().setKey('citationStyle', style)
}

/** BibTeX 글을 읽어 인용 목록에 보탠다 (Google Scholar·Zotero 가 주는 그 글) */
export function importBibtex(text: string): number {
  const entries = parseBibtex(text)
  if (!entries.length) {
    flash('BibTeX 항목을 찾지 못했다 — @article{...} 꼴인지 본다')
    return 0
  }
  const list = loadCitations()
  entries.forEach((e) => list.push(bibEntryToCitation(e)))
  saveCitations(list)
  flash(`BibTeX ${entries.length}건을 인용 목록에 넣었다`)
  return entries.length
}

/** 인용 목록을 .bib 파일로 내보낸다 (Overleaf·LaTeX 에서 바로 쓴다) */
export function exportBibtex(title = 'references'): boolean {
  const list = loadCitations()
  if (!list.length) { flash('인용 목록이 비어 있다 — 인용 관리에서 먼저 넣는다'); return false }
  const blob = new Blob([citationsToBibtex(list)], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title || 'references'}.bib`
  a.click()
  URL.revokeObjectURL(a.href)
  flash(`.bib 로 ${list.length}건 내보냈다`)
  return true
}

export function citationCount(): number {
  return loadCitations().length
}
