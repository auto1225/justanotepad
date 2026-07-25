import { useMemo, useState } from 'react'
import { useMemosStore } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'

interface SearchPanelProps {
  onClose: () => void
}

interface Hit {
  id: string
  title: string
  snippet: string
  matchCount: number
}

/**
 * Phase 6 — 모든 메모 통합 검색.
 * Ctrl+Shift+F. 제목 + 본문 (HTML 평문화) + 태그 검색.
 */
export function SearchPanel({ onClose }: SearchPanelProps) {
  const memos = useMemosStore((s) => s.memos)
  const setCurrent = useMemosStore((s) => s.setCurrent)
  const tagsByMemo = useTagsStore((s) => s.byMemo)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(0)

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const results: Hit[] = []
    for (const m of Object.values(memos)) {
      const title = (m.title || '').toLowerCase()
      const div = document.createElement('div')
      div.innerHTML = m.content || ''
      const body = (div.textContent || '').toLowerCase()
      const tags = (tagsByMemo[m.id] || []).join(' ').toLowerCase()
      const all = title + ' ' + body + ' ' + tags

      // 모든 검색어 단어가 포함되어야 함 (AND)
      const words = term.split(/\s+/).filter(Boolean)
      const allMatch = words.every((w) => all.includes(w))
      if (!allMatch) continue

      // 매치 횟수 카운트 (첫 단어 기준)
      const re = new RegExp(words[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matchCount = (all.match(re) || []).length

      // 스니펫 — 본문에서 첫 매치 ±60자
      const idx = body.indexOf(words[0])
      let snippet: string
      if (idx >= 0) {
        const start = Math.max(0, idx - 60)
        const end = Math.min(body.length, idx + words[0].length + 60)
        snippet = (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '')
      } else {
        snippet = body.slice(0, 120) + (body.length > 120 ? '...' : '')
      }

      results.push({ id: m.id, title: m.title || '무제', snippet, matchCount })
    }
    return results.sort((a, b) => b.matchCount - a.matchCount).slice(0, 50)
  }, [q, memos, tagsByMemo])

  function open(id: string) {
    setCurrent(id)
    onClose()
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && hits[selected]) {
      e.preventDefault()
      open(hits[selected].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>전체 검색</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <input
            autoFocus
            type="text"
            className="jan-search-input"
            placeholder="제목 / 본문 / 태그 — 띄어쓰기로 AND 검색"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSelected(0) }}
            onKeyDown={onKey}
          />
          <div className="jan-search-stats">
            {q ? `${hits.length}개 메모에서 발견` : `전체 ${Object.keys(memos).length}개 메모`}
          </div>
          <ul className="jan-search-list">
            {hits.map((h, i) => (
              <li
                key={h.id}
                className={'jan-search-item' + (i === selected ? ' is-selected' : '')}
                onClick={() => open(h.id)}
                onMouseEnter={() => setSelected(i)}
              >
                <div className="jan-search-title">{h.title}</div>
                <div className="jan-search-snippet">{h.snippet}</div>
                <div className="jan-search-meta">{h.matchCount}회 매치</div>
              </li>
            ))}
            {q && hits.length === 0 && <li className="jan-search-empty">검색 결과 없음</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
