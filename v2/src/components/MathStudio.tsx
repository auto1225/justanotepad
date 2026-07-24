import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import katex from 'katex'
import { MATH_SYMBOL_GROUPS, MATH_TEMPLATES2, MATH_SNIPPETS, type Sym } from '../lib/mathSymbols'
import { insertNumberedEquation } from '../lib/paperRefs'
import { flash } from '../lib/flash'

/**
 * 수식 스튜디오 — 전 이공계 수식 편집기.
 *  - 실시간 KaTeX 미리보기 (오류 표시 포함)
 *  - 분야별 기호 팔레트 15+탭 (수학·물리·화학·통계·전기·기계·전산·생물·단위...)
 *  - 구조 템플릿(행렬·케이스·정렬) + 대표 공식 스니펫 + 통합 검색
 *  - 자리표시자 □: Tab/Shift+Tab 으로 다음/이전 칸 이동
 *  - 최근 사용 기호 기억, 인라인/번호 수식 두 가지 삽입
 */
interface MathStudioProps {
  editor: Editor | null
  onClose: () => void
  initial?: string
  /** edit 모드: 삽입 대신 onSave 로 반환 (기존 노드 갱신용) */
  onSave?: (latex: string) => void
}

const RECENT_KEY = 'jan-v2-math-recent'
const PLACEHOLDER = '□'

function loadRecent(): Sym[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecent(sym: Sym) {
  try {
    const cur = loadRecent().filter((s) => s.tex !== sym.tex)
    localStorage.setItem(RECENT_KEY, JSON.stringify([sym, ...cur].slice(0, 14)))
  } catch { /* 무시 */ }
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.replace(/□/g, '\\square'), { throwOnError: true, displayMode, output: 'html' })
  } catch (e) {
    return `<span class="jan-ms-err">${(e instanceof Error ? e.message : 'LaTeX 오류').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`
  }
}

/** 커서 위치에 tex 삽입, 첫 □ 를 선택 상태로 */
function insertAtCursor(ta: HTMLTextAreaElement, tex: string, setValue: (v: string) => void) {
  const start = ta.selectionStart ?? ta.value.length
  const end = ta.selectionEnd ?? start
  const before = ta.value.slice(0, start)
  const after = ta.value.slice(end)
  // 선택 중이던 텍스트가 있으면 첫 □ 자리에 넣어준다 (감싸기)
  const selected = ta.value.slice(start, end)
  const payload = selected && tex.includes(PLACEHOLDER) ? tex.replace(PLACEHOLDER, selected) : tex
  const next = before + payload + after
  setValue(next)
  requestAnimationFrame(() => {
    ta.focus()
    const phIdx = next.indexOf(PLACEHOLDER, start)
    if (phIdx >= 0 && phIdx < start + payload.length) {
      ta.setSelectionRange(phIdx, phIdx + 1)
    } else {
      const pos = start + payload.length
      ta.setSelectionRange(pos, pos)
    }
  })
}

export function MathStudio({ editor, onClose, initial = '', onSave }: MathStudioProps) {
  const [latex, setLatex] = useState(initial)
  const [tab, setTab] = useState<string>('templates')
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<Sym[]>(() => loadRecent())
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    taRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const previewHtml = useMemo(() => (latex.trim() ? renderKatex(latex, true) : '<span class="jan-ms-hint">기호를 클릭하거나 LaTeX 를 입력하세요</span>'), [latex])

  /** 통합 검색 — 모든 그룹·템플릿·공식에서 */
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    const out: Array<Sym & { badge?: string }> = []
    for (const g of MATH_SYMBOL_GROUPS) {
      for (const s of g.items) {
        if (s.tip.toLowerCase().includes(q) || s.tex.toLowerCase().includes(q)) out.push({ ...s, badge: g.label })
      }
    }
    for (const s of MATH_TEMPLATES2) {
      if (s.tip.toLowerCase().includes(q) || s.tex.toLowerCase().includes(q)) out.push({ ...s, badge: '구조' })
    }
    for (const s of MATH_SNIPPETS) {
      if (s.label.toLowerCase().includes(q) || s.field.toLowerCase().includes(q) || s.tex.toLowerCase().includes(q)) {
        out.push({ tex: s.tex, tip: `${s.field} · ${s.label}`, badge: '공식' })
      }
    }
    return out.slice(0, 60)
  }, [query])

  function pick(sym: Sym) {
    if (!taRef.current) return
    insertAtCursor(taRef.current, sym.tex, setLatex)
    pushRecent(sym)
    setRecent(loadRecent())
  }

  /** Tab: 다음 □ 선택, Shift+Tab: 이전 □ */
  function onTaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    const ta = taRef.current
    if (!ta || !ta.value.includes(PLACEHOLDER)) return
    e.preventDefault()
    const from = ta.selectionEnd ?? 0
    let idx: number
    if (e.shiftKey) {
      idx = ta.value.lastIndexOf(PLACEHOLDER, Math.max(0, (ta.selectionStart ?? 0) - 1))
      if (idx < 0) idx = ta.value.lastIndexOf(PLACEHOLDER)
    } else {
      idx = ta.value.indexOf(PLACEHOLDER, from)
      if (idx < 0) idx = ta.value.indexOf(PLACEHOLDER)
    }
    if (idx >= 0) ta.setSelectionRange(idx, idx + 1)
  }

  function finalLatex(): string | null {
    const cleaned = latex.replace(/□/g, '{\\,}').trim()
    if (!cleaned) return null
    return cleaned
  }

  function doInsertInline() {
    const v = finalLatex()
    if (!v) return
    if (onSave) { onSave(v); onClose(); return }
    if (!editor) return
    ;(editor.chain() as unknown as { focus: () => { setMath: (l: string) => { run: () => void } } }).focus().setMath(v).run()
    onClose()
  }

  function doInsertNumbered() {
    const v = finalLatex()
    if (!v) return
    if (onSave) { onSave(v); onClose(); return }
    if (!editor) return
    insertNumberedEquation(editor, v)
    flash('번호 수식 삽입 — 논문 메뉴의 "수식 참조"로 인용할 수 있습니다')
    onClose()
  }

  const activeItems: Array<Sym & { badge?: string }> = useMemo(() => {
    if (tab === 'templates') return MATH_TEMPLATES2
    if (tab === 'snippets') return MATH_SNIPPETS.map((s) => ({ tex: s.tex, tip: `${s.field} · ${s.label}` }))
    return MATH_SYMBOL_GROUPS.find((g) => g.key === tab)?.items ?? []
  }, [tab])

  const shownItems = searchResults ?? activeItems

  return (
    <div className="jan-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="jan-modal jan-math-studio" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="수식 스튜디오">
        <div className="jan-modal-head">
          <h3>수식 스튜디오</h3>
          <button className="jan-modal-close" onClick={onClose} aria-label="닫기">닫기</button>
        </div>

        <div className="jan-ms-body">
          {/* 실시간 미리보기 */}
          <div className="jan-ms-preview" aria-live="polite" dangerouslySetInnerHTML={{ __html: previewHtml }} />

          {/* LaTeX 입력 */}
          <textarea
            ref={taRef}
            className="jan-ms-input"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            onKeyDown={onTaKeyDown}
            placeholder="LaTeX 입력 — 예: \frac{a}{b},  \ce{H2O},  Tab 키로 □ 칸 이동"
            rows={3}
            spellCheck={false}
            aria-label="LaTeX 수식 입력"
          />

          {/* 검색 + 탭 */}
          <div className="jan-ms-toolrow">
            <input
              className="jan-ms-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="통합 검색 — 예: integral, 행렬 hat, 베르누이, ohm..."
              aria-label="기호·공식 검색"
            />
          </div>
          {!searchResults && (
            <div className="jan-ms-tabs" role="tablist" aria-label="기호 분류">
              <button role="tab" aria-selected={tab === 'templates'} className={tab === 'templates' ? 'is-active' : ''} onClick={() => setTab('templates')}>구조</button>
              {MATH_SYMBOL_GROUPS.map((g) => (
                <button key={g.key} role="tab" aria-selected={tab === g.key} className={tab === g.key ? 'is-active' : ''} onClick={() => setTab(g.key)}>{g.label}</button>
              ))}
              <button role="tab" aria-selected={tab === 'snippets'} className={tab === 'snippets' ? 'is-active' : ''} onClick={() => setTab('snippets')}>공식</button>
            </div>
          )}

          {/* 팔레트 */}
          <div className="jan-ms-palette" role="listbox" aria-label="기호 팔레트">
            {shownItems.map((s, i) => (
              <button
                key={s.tex + i}
                type="button"
                className="jan-ms-sym"
                title={`${s.tip}${s.badge ? ` (${s.badge})` : ''} — ${s.tex}`}
                onClick={() => pick(s)}
              >
                <span dangerouslySetInnerHTML={{ __html: renderKatex(s.tex.length > 60 ? s.tex.slice(0, 60) : s.tex, false) }} />
                {(tab === 'snippets' || s.badge === '공식') && <small>{s.tip}</small>}
              </button>
            ))}
            {shownItems.length === 0 && <div className="jan-ms-empty">검색 결과 없음</div>}
          </div>

          {/* 최근 사용 */}
          {recent.length > 0 && !searchResults && (
            <div className="jan-ms-recent" aria-label="최근 사용">
              <span>최근:</span>
              {recent.map((s, i) => (
                <button key={s.tex + i} type="button" title={s.tip} onClick={() => pick(s)}>
                  <span dangerouslySetInnerHTML={{ __html: renderKatex(s.tex, false) }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="jan-ms-foot">
          <span className="jan-ms-note">Tab: 다음 □ 칸 · Esc: 닫기 · 텍스트 선택 후 기호 클릭 = 감싸기</span>
          <span className="flex-spacer" />
          {onSave ? (
            <button type="button" className="jan-ms-btn jan-ms-btn-primary" onClick={doInsertInline} disabled={!latex.trim()}>저장</button>
          ) : (
            <>
              <button type="button" className="jan-ms-btn" onClick={doInsertInline} disabled={!latex.trim()}>인라인 삽입</button>
              <button type="button" className="jan-ms-btn jan-ms-btn-primary" onClick={doInsertNumbered} disabled={!latex.trim()}>번호 수식 (n) 삽입</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
