import { useState, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useSettingsStore } from '../store/settingsStore'
import { CITATION_STYLES, formatBibEntry, formatInline, type Citation, type CitationStyle } from '../lib/citationFormat'
import { bibEntryToCitation, citationsToBibtex, parseBibtex } from '../lib/bibtex'
/* 인용 목록은 논문 탭과 함께 쓴다 — 저장 자리를 한 곳에 둔다 */
import { loadCitations, saveCitations } from '../lib/paperCites'
import { flash } from '../lib/flash'

/** CrossRef 검색 결과 — 쓰는 항목만 */
interface CrossRefItem {
  author?: Array<{ given?: string; family?: string; name?: string }>
  title?: string[]
  issued?: { 'date-parts'?: number[][] }
  'container-title'?: string[]
  publisher?: string
  volume?: string
  issue?: string
  page?: string
  DOI?: string
}


interface PaperPanelProps {
  editor: Editor | null
  onClose: () => void
}

const EMPTY: Citation = { id: '', authors: [''], title: '', year: '' }

/**
 * Phase 5 — 논문 모드 패널.
 * 인용 추가/편집 → APA/IEEE/MLA 본문 인라인 + Bibliography 섹션 자동 삽입.
 * 인용 목록은 localStorage 에 영속 (모달 닫아도 보존).
 */
export function PaperPanel({ editor, onClose }: PaperPanelProps) {
  const style = useSettingsStore((s) => s.citationStyle)
  const setStyle = (st: CitationStyle) => useSettingsStore.getState().setKey('citationStyle', st)
  const [cites, setCites] = useState<Citation[]>(() => loadCitations())
  const [draft, setDraft] = useState<Citation>({ ...EMPTY })
  const [doiInput, setDoiInput] = useState('')
  const [doiBusy, setDoiBusy] = useState(false)
  const [doiError, setDoiError] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<Citation[]>([])
  const [bibOpen, setBibOpen] = useState(false)
  const [bibText, setBibText] = useState('')

  /** 중복(같은 DOI 또는 같은 제목) 제외하고 목록에 추가 */
  function addUnique(list: Citation[]): number {
    let added = 0
    setCites((cs) => {
      const next = [...cs]
      for (const c of list) {
        const dup = next.some((x) =>
          (c.doi && x.doi && x.doi.toLowerCase() === c.doi.toLowerCase()) ||
          (c.title && x.title.trim().toLowerCase() === c.title.trim().toLowerCase()))
        if (!dup) { next.push({ ...c, id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6) }); added++ }
      }
      return next
    })
    return added
  }

  /** BibTeX 텍스트 가져오기 */
  function importBibtex() {
    const entries = parseBibtex(bibText)
    if (!entries.length) { flash('BibTeX 항목을 찾지 못했습니다'); return }
    const list = entries.map(bibEntryToCitation).filter((c) => c.title)
    addUnique(list)
    flash(`BibTeX ${list.length}건 파싱 — 중복 제외 후 추가됨`)
    setBibText(''); setBibOpen(false)
  }

  /** BibTeX 내보내기 (.bib 다운로드) */
  function exportBibtex() {
    if (!cites.length) return
    const blob = new Blob([citationsToBibtex(cites)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'references.bib'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  /** arXiv ID → 메타데이터.
   * arXiv 자체 API 는 브라우저 CORS 를 막으므로, 모든 arXiv 논문에 발급되는
   * DataCite DOI(10.48550/arXiv.ID)를 CORS 허용 API 로 조회한다. */
  async function fetchArxiv(id: string): Promise<Citation | null> {
    const clean = id.replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '').replace(/^arxiv:\s*/i, '').replace(/(v\d+)?(\.pdf)?$/i, '')
    const doi = `10.48550/arXiv.${clean}`
    const res = await fetch(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`)
    if (!res.ok) throw new Error(res.status === 404 ? 'arXiv 항목을 찾지 못했습니다' : `DataCite ${res.status}`)
    const j = await res.json()
    const a = j.data?.attributes
    const title = a?.titles?.[0]?.title?.replace(/\s+/g, ' ').trim()
    if (!title) return null
    // DataCite 저자는 "Last, First" — 표시용 "First Last" 로 변환
    const authors = ((a.creators || []) as Array<{ name?: string; givenName?: string; familyName?: string }>)
      .map((c) => {
        if (c.givenName || c.familyName) return [c.givenName, c.familyName].filter(Boolean).join(' ')
        const nm = c.name || ''
        if (nm.includes(',')) { const [last, first] = nm.split(',').map((s) => s.trim()); return [first, last].filter(Boolean).join(' ') }
        return nm
      })
      .filter(Boolean)
    return {
      id: '', type: 'article', authors: authors.length ? authors : [''], title,
      year: String(a.publicationYear || ''), venue: `arXiv:${clean}`, doi,
      url: `https://arxiv.org/abs/${clean}`,
    }
  }

  /** 제목/자유 검색 (CrossRef) → 상위 5건 */
  async function searchCrossref(q: string) {
    const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=5&select=title,author,issued,container-title,volume,issue,page,DOI,publisher`)
    if (!res.ok) throw new Error(`CrossRef ${res.status}`)
    const j = await res.json()
    const items = (j.message?.items || []) as CrossRefItem[]
    return items.map((m): Citation => ({
      id: '', type: 'article',
      authors: (m.author || []).map((a) => a.name || [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
      title: (m.title && m.title[0]) || '',
      year: String(m.issued?.['date-parts']?.[0]?.[0] || ''),
      venue: (m['container-title'] && m['container-title'][0]) || m.publisher || '',
      volume: m.volume || '', issue: m.issue || '', pages: m.page || '', doi: m.DOI || '',
    })).filter((c) => c.title)
  }

  /** 통합 가져오기 — DOI / arXiv / 제목 검색을 입력 형태로 자동 판별 */
  async function smartFetch() {
    const raw = doiInput.trim()
    if (!raw) return
    setDoiBusy(true); setDoiError(''); setSearchResults([])
    try {
      if (/arxiv/i.test(raw) || /^\d{4}\.\d{4,5}(v\d+)?$/.test(raw)) {
        const c = await fetchArxiv(raw)
        if (!c) throw new Error('arXiv 항목을 찾지 못했습니다')
        setDraft(c); setDoiInput('')
      } else if (/^(https?:\/\/(dx\.)?doi\.org\/|doi:)?10\.\S+\/\S+/i.test(raw)) {
        await fetchDoi()
        return
      } else {
        const results = await searchCrossref(raw)
        if (!results.length) throw new Error('검색 결과가 없습니다')
        setSearchResults(results)
      }
    } catch (e) {
      setDoiError(e instanceof Error ? e.message : '가져오기 실패')
    } finally {
      setDoiBusy(false)
    }
  }

  function startEdit(idx: number) {
    setDraft({ ...cites[idx] })
    setEditingIdx(idx)
  }
  function saveEdit() {
    if (editingIdx == null) return
    setCites((cs) => cs.map((c, i) => (i === editingIdx ? { ...draft, id: c.id } : c)))
    setEditingIdx(null)
    setDraft({ ...EMPTY })
  }

  type SortKey = 'author' | 'year' | 'added'
  function sortCites(key: SortKey) {
    setCites((cs) => {
      const next = [...cs]
      if (key === 'author') next.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''))
      else if (key === 'year') next.sort((a, b) => (b.year || '').localeCompare(a.year || ''))
      else next.sort((a, b) => a.id.localeCompare(b.id))
      return next
    })
  }

  /** DOI → CrossRef 메타데이터로 인용 자동 완성 (Overleaf/Zotero 급) */
  async function fetchDoi() {
    const raw = doiInput.trim()
    if (!raw) return
    // https://doi.org/10.xxxx/... 또는 doi:10.xxxx 형태 모두 허용
    const doi = raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '')
    if (!/^10\.\S+\/\S+/.test(doi)) { setDoiError('DOI 형식이 아닙니다 (예: 10.1038/nature14539)'); return }
    setDoiBusy(true); setDoiError('')
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`CrossRef ${res.status}`)
      const j = await res.json()
      const m = j.message
      const authors: string[] = (m.author || []).map((a: { given?: string; family?: string; name?: string }) =>
        a.name || [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean)
      setDraft({
        id: '',
        authors: authors.length ? authors : [''],
        title: (m.title && m.title[0]) || '',
        year: String(m.issued?.['date-parts']?.[0]?.[0] || m.created?.['date-parts']?.[0]?.[0] || ''),
        venue: (m['container-title'] && m['container-title'][0]) || m.publisher || '',
        volume: m.volume || '',
        issue: m.issue || '',
        pages: m.page || '',
        publisher: m.publisher || '',
        doi: m.DOI || doi,
        url: '',
        type: m.type === 'proceedings-article' ? 'conference' : m.type === 'book' ? 'book' : 'article',
      })
      setDoiInput('')
    } catch (e) {
      setDoiError(`가져오기 실패 — DOI를 확인하세요 (${e instanceof Error ? e.message : '네트워크 오류'})`)
    } finally {
      setDoiBusy(false)
    }
  }

  // 변경 시마다 localStorage 동기화
  useEffect(() => {
    saveCitations(cites)
  }, [cites])

  if (!editor) return null

  function add() {
    if (!draft.title.trim()) return
    const c: Citation = { ...draft, id: 'c' + Date.now() }
    setCites((cs) => [...cs, c])
    setDraft({ ...EMPTY })
  }
  function remove(idx: number) {
    setCites((cs) => cs.filter((_, i) => i !== idx))
  }
  function clearAll() {
    if (cites.length === 0) return
    if (window.confirm(`인용 ${cites.length}개 모두 삭제할까요?`)) setCites([])
  }

  function insertInline(idx: number) {
    if (!editor) return
    const tag = formatInline(cites[idx], style, idx)
    editor.chain().focus().insertContent(`<sup>${tag}</sup>`).run()
  }

  function insertBibliography() {
    if (!editor || cites.length === 0) return
    const lines = cites
      .map((c, i) => `<p style="text-indent:-2em;padding-left:2em;">${formatBibEntry(c, style, i)}</p>`)
      .join('')
    const html = `<h2>References</h2>${lines}`
    editor.chain().focus().insertContent(html).run()
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-paper-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>논문 모드 — 인용 관리</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-paper-style-row">
            <span>인용 스타일:</span>
            {CITATION_STYLES.map((s) => (
              <button
                key={s.value}
                className={'jan-paper-style' + (style === s.value ? ' is-active' : '')}
                onClick={() => setStyle(s.value as CitationStyle)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="jan-paper-doi-row">
            <input
              placeholder="DOI · arXiv ID · 제목 검색 — 예: 10.1038/nature14539 / 1706.03762 / attention is all you need"
              value={doiInput}
              onChange={(e) => { setDoiInput(e.target.value); setDoiError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void smartFetch() } }}
              aria-label="DOI 입력"
            />
            <button type="button" onClick={() => void smartFetch()} disabled={doiBusy || !doiInput.trim()}>
              {doiBusy ? '가져오는 중...' : '자동 가져오기'}
            </button>
          </div>
          {doiError && <div className="jan-paper-doi-error" role="alert">{doiError}</div>}
          {searchResults.length > 0 && (
            <div className="jan-paper-search-results" role="listbox" aria-label="검색 결과">
              {searchResults.map((r, i) => (
                <button key={i} type="button" onClick={() => { setDraft(r); setSearchResults([]) }}>
                  <strong>{r.title}</strong>
                  <span>{r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' 외' : ''} · {r.venue} · {r.year}</span>
                </button>
              ))}
            </div>
          )}

          <div className="jan-paper-form">
            <input
              placeholder="저자 (쉼표 구분: John Doe, Jane Smith)"
              value={draft.authors.join(', ')}
              onChange={(e) => setDraft({ ...draft, authors: e.target.value.split(',').map((s) => s.trim()) })}
            />
            <div className="jan-paper-row">
              <input
                placeholder="연도"
                value={draft.year || ''}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                style={{ width: 80 }}
              />
              <input
                placeholder="제목"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
            <input
              placeholder="저널/책/학회명"
              value={draft.venue || ''}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
            />
            <div className="jan-paper-row">
              <input placeholder="vol" value={draft.volume || ''} onChange={(e) => setDraft({ ...draft, volume: e.target.value })} style={{ width: 70 }} />
              <input placeholder="no" value={draft.issue || ''} onChange={(e) => setDraft({ ...draft, issue: e.target.value })} style={{ width: 70 }} />
              <input placeholder="페이지 (12-34)" value={draft.pages || ''} onChange={(e) => setDraft({ ...draft, pages: e.target.value })} style={{ flex: 1 }} />
            </div>
            <input
              placeholder="DOI 또는 URL"
              value={draft.doi || draft.url || ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                // 전체 URL 을 doi 필드에 넣으면 https://doi.org/https://... 로 망가진다
                if (/^https?:\/\//i.test(v)) setDraft({ ...draft, url: v, doi: '' })
                else setDraft({ ...draft, doi: v, url: '' })
              }}
            />
            {editingIdx == null ? (
              <button className="jan-paper-add" onClick={add}>인용 추가</button>
            ) : (
              <div className="jan-paper-edit-row">
                <button className="jan-paper-add" onClick={saveEdit}>수정 저장</button>
                <button className="jan-paper-cancel" onClick={() => { setEditingIdx(null); setDraft({ ...EMPTY }) }}>취소</button>
              </div>
            )}
          </div>

          <div className="jan-paper-tools-row">
            <span>정렬:</span>
            <button type="button" onClick={() => sortCites('author')}>저자</button>
            <button type="button" onClick={() => sortCites('year')}>연도</button>
            <button type="button" onClick={() => sortCites('added')}>추가순</button>
            <span className="flex-spacer" />
            <button type="button" onClick={() => setBibOpen((v) => !v)}>BibTeX 가져오기</button>
            <button type="button" onClick={exportBibtex} disabled={cites.length === 0}>.bib 내보내기</button>
          </div>
          {bibOpen && (
            <div className="jan-paper-bib-import">
              <textarea
                value={bibText}
                onChange={(e) => setBibText(e.target.value)}
                placeholder={'@article{key,\n  author = {John Doe and Jane Smith},\n  title = {Paper Title},\n  journal = {Journal},\n  year = {2024}\n}\n... (여러 항목 붙여넣기 가능)'}
                rows={6}
                aria-label="BibTeX 붙여넣기"
              />
              <button type="button" onClick={importBibtex} disabled={!bibText.trim()}>파싱해서 추가</button>
            </div>
          )}

          <div className="jan-paper-list">
            {cites.length === 0 && <div className="jan-paper-empty">인용을 추가하세요.</div>}
            {cites.map((c, i) => (
              <div key={c.id} className={'jan-paper-item' + (editingIdx === i ? ' is-editing' : '')}>
                <div className="jan-paper-num">[{i + 1}]</div>
                <div className="jan-paper-text">{formatBibEntry(c, style, i)}</div>
                <button onClick={() => insertInline(i)} title="본문에 인라인 인용 삽입">본문 인용</button>
                <button onClick={() => startEdit(i)} title="편집">편집</button>
                <button onClick={() => remove(i)} title="삭제">×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="jan-paper-bib" onClick={insertBibliography} disabled={cites.length === 0}>
              References 섹션 삽입 ({cites.length})
            </button>
            {cites.length > 0 && (
              <button onClick={clearAll} style={{ padding: '8px 14px', border: '1px solid #ccc', background: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                전체 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
