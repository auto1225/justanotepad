import { useEffect, useMemo, useRef, useState } from 'react'
import { canQueryLocalFonts, clearFontCache, getKnownFonts, loadAllSystemFonts, type FontEntry } from '../lib/systemFonts'

const RECENT_KEY = 'jan-v2-recent-fonts'
const MAX_RECENT = 6

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[] } catch { return [] }
}

/**
 * 글꼴 고르기 — 워드처럼 이름을 그 글꼴로 보여 주고, 입력해서 걸러 찾는다.
 * 목록은 이 컴퓨터에 깔린 글꼴에서 온다(systemFonts).
 */
export function FontCombo({ value, onPick }: { value: string; onPick: (cssValue: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // 목록은 첫 렌더에 한 번 만든다 (저장된 목록이 있으면 그것, 없으면 권한 없이 찾은 것)
  const [fonts, setFonts] = useState<FontEntry[]>(() => getKnownFonts())
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const label = useMemo(() => {
    if (!value) return '기본 글꼴'
    const hit = fonts.find((f) => f.value === value)
    return hit?.label || value.replace(/"/g, '').split(',')[0]
  }, [value, fonts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? fonts.filter((f) => f.label.toLowerCase().includes(q)) : fonts
    return list.slice(0, 400)
  }, [fonts, query])

  const recentEntries = useMemo(
    () => recent.map((v) => fonts.find((f) => f.value === v) || { value: v, label: v.replace(/"/g, '') }).slice(0, MAX_RECENT),
    [recent, fonts]
  )

  const pick = (entry: FontEntry | null) => {
    onPick(entry ? entry.value : '')
    if (entry) {
      const next = [entry.value, ...recent.filter((r) => r !== entry.value)].slice(0, MAX_RECENT)
      setRecent(next)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* 무시 */ }
    }
    setOpen(false)
    setQuery('')
  }

  const loadAll = async () => {
    setLoading(true)
    setNote('')
    try {
      const { fonts: all, granted } = await loadAllSystemFonts()
      setFonts(all)
      setNote(granted ? `이 컴퓨터 글꼴 ${all.length}개를 불러왔습니다` : `권한 없이 찾은 글꼴 ${all.length}개입니다`)
    } catch {
      setNote('글꼴을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    clearFontCache()
    await loadAll()
  }

  return (
    <div className="jan-fontcombo" ref={boxRef}>
      <button
        type="button"
        className="jan-fontcombo-btn"
        title="글꼴 (선택 영역에 적용)"
        aria-label="글꼴"
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 0) }}
        style={{ fontFamily: value || undefined }}
      >
        <span className="jan-fontcombo-label">{label}</span>
        <svg viewBox="0 0 8 5" width="8" height="5" aria-hidden="true"><path d="M4 5 0 0h8z" fill="currentColor" /></svg>
      </button>

      {open && (
        <div className="jan-fontcombo-pop" role="listbox" aria-label="글꼴 목록">
          <input
            ref={inputRef}
            className="jan-fontcombo-search"
            placeholder="글꼴 이름 검색"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[cursor] || null) }
              else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
              e.stopPropagation()
            }}
          />

          <div className="jan-fontcombo-list">
            <button type="button" className="jan-fontcombo-item" onClick={() => pick(null)}>
              <span className="jan-fontcombo-check">{value ? '' : '✓'}</span>기본 글꼴 (문서 스타일 따름)
            </button>

            {!query && recentEntries.length > 0 && (
              <>
                <div className="jan-fontcombo-sec">최근 사용</div>
                {recentEntries.map((f) => (
                  <button key={'r-' + f.value} type="button" className="jan-fontcombo-item" style={{ fontFamily: f.value }} onClick={() => pick(f)}>
                    <span className="jan-fontcombo-check">{value === f.value ? '✓' : ''}</span>{f.label}
                  </button>
                ))}
              </>
            )}

            <div className="jan-fontcombo-sec">이 컴퓨터 글꼴 ({fonts.length})</div>
            {filtered.map((f, i) => (
              <button
                key={f.value}
                type="button"
                className={'jan-fontcombo-item' + (i === cursor ? ' is-cursor' : '')}
                style={{ fontFamily: f.value }}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(f)}
              >
                <span className="jan-fontcombo-check">{value === f.value ? '✓' : ''}</span>{f.label}
              </button>
            ))}
            {filtered.length === 0 && <div className="jan-fontcombo-empty">찾는 글꼴이 없습니다</div>}
          </div>

          <div className="jan-fontcombo-foot">
            <button type="button" onClick={loadAll} disabled={loading}>
              {loading ? '불러오는 중…' : canQueryLocalFonts() ? '이 컴퓨터 글꼴 모두 불러오기' : '설치된 글꼴 다시 찾기'}
            </button>
            <button type="button" onClick={refresh} disabled={loading} title="글꼴을 새로 설치했을 때">새로 고침</button>
          </div>
          {note && <div className="jan-fontcombo-note">{note}</div>}
        </div>
      )}
    </div>
  )
}
