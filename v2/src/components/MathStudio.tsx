import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import katex from 'katex'
import { MATH_SYMBOL_GROUPS, MATH_TEMPLATES2, koExpand, type Sym } from '../lib/mathSymbols'
import { FORMULA_LIBRARY, FORMULA_FIELDS, PHYSICAL_CONSTANTS } from '../lib/formulaLibrary'
import { insertNumberedEquation } from '../lib/paperRefs'
import { runAiVision, aiConfigured } from '../lib/aiApi'
import { flash } from '../lib/flash'

const VISION_PROMPT = '이 이미지에 있는 수식을 KaTeX 호환 LaTeX 로 변환해줘. 설명 없이 LaTeX 코드만 출력해. 수식이 여러 개면 \\\\ 로 구분해. 화학식이면 mhchem \\ce{...} 문법을 사용해.'

/** AI 응답에서 LaTeX 만 추출 (코드펜스·$ 구분자 제거) */
function extractLatex(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:latex|tex|math)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  s = s.replace(/^\$\$?|\$\$?$/g, '').trim()
  return s
}

/** 자동완성 후보 — 팔레트 전 항목에서 \명령 만 추출 + 자주 쓰는 명령 보강 */
const AUTOCOMPLETE_COMMANDS: Sym[] = (() => {
  const seen = new Map<string, Sym>()
  const add = (tex: string, tip: string) => {
    const m = tex.match(/^\\[a-zA-Z]+/)
    if (!m) return
    if (!seen.has(tex)) seen.set(tex, { tex, tip })
  }
  for (const g of MATH_SYMBOL_GROUPS) for (const s of g.items) add(s.tex, s.tip)
  for (const s of MATH_TEMPLATES2) add(s.tex, s.tip)
  ;[
    ['\\frac{□}{□}', 'fraction'], ['\\sqrt{□}', 'sqrt'], ['\\text{□}', 'text'], ['\\mathbf{□}', 'bold'],
    ['\\mathrm{□}', 'roman'], ['\\mathcal{□}', 'calligraphic'], ['\\mathbb{□}', 'blackboard'], ['\\boldsymbol{□}', 'bold symbol'],
    ['\\ce{□}', 'chemistry'], ['\\cdots', 'cdots'], ['\\ldots', 'ldots'], ['\\quad', 'quad space'], ['\\qquad', 'wide space'],
  ].forEach(([t, tip]) => add(t, tip))
  return [...seen.values()]
})()

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

// 팔레트는 같은 tex 를 반복 렌더하므로 캐시 — 검색 타이핑(특히 한글 IME 조합) 중
// 키 입력마다 KaTeX 수십 개를 동기 렌더하면 조합이 버벅이는 것을 방지
const katexCache = new Map<string, string>()

function renderKatex(tex: string, displayMode: boolean): string {
  const key = (displayMode ? 'D:' : 'I:') + tex
  const hit = katexCache.get(key)
  if (hit !== undefined) return hit
  let html: string
  try {
    html = katex.renderToString(tex.replace(/□/g, '\\square'), { throwOnError: true, displayMode, output: 'html' })
  } catch (e) {
    html = `<span class="jan-ms-err">${(e instanceof Error ? e.message : 'LaTeX 오류').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`
  }
  if (katexCache.size > 1200) katexCache.clear()
  katexCache.set(key, html)
  return html
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
  const [fieldFilter, setFieldFilter] = useState<string>('전체')
  const [ac, setAc] = useState<{ items: Sym[]; sel: number; word: string } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [padOpen, setPadOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const padRef = useRef<HTMLCanvasElement>(null)
  const padDrawing = useRef(false)

  /** 이미지 dataUrl → AI 비전 → LaTeX 를 입력창에 */
  async function recognizeDataUrl(dataUrl: string) {
    if (!aiConfigured()) { flash('설정에서 AI API 키를 먼저 등록하세요 (BYOK)'); return }
    setAiBusy(true)
    try {
      const r = await runAiVision(VISION_PROMPT, dataUrl)
      const tex = extractLatex(r.text || '')
      if (!tex) { flash('수식을 인식하지 못했습니다'); return }
      setLatex((prev) => (prev.trim() ? prev + '\n' + tex : tex))
      flash('AI 인식 완료 — 미리보기를 확인하세요')
    } catch (e) {
      flash('인식 실패: ' + (e instanceof Error ? e.message : '오류'))
    } finally {
      setAiBusy(false)
    }
  }

  function recognizeFromFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.cssText = 'position:fixed;left:-9999px'
    input.onchange = () => {
      const f = input.files?.[0]
      input.remove()
      if (!f) return
      const reader = new FileReader()
      reader.onload = () => { void recognizeDataUrl(String(reader.result)) }
      reader.readAsDataURL(f)
    }
    document.body.appendChild(input)
    input.click()
  }

  /* 손글씨 패드 */
  function padPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = padRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function padDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = padRef.current?.getContext('2d')
    if (!ctx) return
    padDrawing.current = true
    const p = padPos(e)
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#111'
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
    try { padRef.current?.setPointerCapture(e.pointerId) } catch { /* 무시 */ }
  }
  function padMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!padDrawing.current) return
    const ctx = padRef.current?.getContext('2d')
    if (!ctx) return
    const p = padPos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  function padUp() { padDrawing.current = false }
  function padClear() {
    const c = padRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  }
  function padRecognize() {
    const c = padRef.current
    if (!c) return
    setPadOpen(false)
    void recognizeDataUrl(c.toDataURL('image/png'))
  }
  useEffect(() => { if (padOpen) padClear() }, [padOpen])

  /** 자동완성 — 커서 앞의 \명령 조각을 찾아 후보 제시 */
  function updateAutocomplete(value: string, caret: number) {
    const before = value.slice(0, caret)
    const m = before.match(/\\([a-zA-Z]{1,20})$/)
    if (!m) { setAc(null); return }
    const word = m[0] // 예: \fr
    const items = AUTOCOMPLETE_COMMANDS
      .filter((c) => c.tex.toLowerCase().startsWith(word.toLowerCase()) && c.tex !== word)
      .slice(0, 8)
    setAc(items.length ? { items, sel: 0, word } : null)
  }

  function acceptAutocomplete(item: Sym) {
    const ta = taRef.current
    if (!ta || !ac) return
    const caret = ta.selectionStart ?? 0
    const before = latex.slice(0, caret - ac.word.length)
    const after = latex.slice(caret)
    const next = before + item.tex + after
    setLatex(next)
    setAc(null)
    requestAnimationFrame(() => {
      ta.focus()
      const phIdx = next.indexOf(PLACEHOLDER, before.length)
      if (phIdx >= 0 && phIdx < before.length + item.tex.length) ta.setSelectionRange(phIdx, phIdx + 1)
      else { const p = before.length + item.tex.length; ta.setSelectionRange(p, p) }
    })
  }

  const acOpenRef = useRef(false)
  acOpenRef.current = !!ac

  useEffect(() => {
    taRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (acOpenRef.current) { e.stopPropagation(); window.dispatchEvent(new Event('jan-ms-close-ac')); return }
        onClose()
      }
    }
    const closeAc = () => setAc(null)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('jan-ms-close-ac', closeAc)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('jan-ms-close-ac', closeAc)
    }
  }, [onClose])

  const previewHtml = useMemo(() => (latex.trim() ? renderKatex(latex, true) : '<span class="jan-ms-hint">기호를 클릭하거나 LaTeX 를 입력하세요</span>'), [latex])

  // 검색 재계산을 입력보다 한 박자 늦춰 한글 IME 조합이 무거운 렌더에 끊기지 않게 한다
  const deferredQuery = useDeferredValue(query)

  /** 통합 검색 — 기호(한글 동의어 포함)·구조·공식 121·물리상수 전부에서 */
  const searchResults = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return null
    const out: Array<Sym & { badge?: string }> = []
    for (const g of MATH_SYMBOL_GROUPS) {
      for (const s of g.items) {
        // 영문 tip + LaTeX + 그룹명(한글) + 한글 동의어 사전 확장까지 모두 매칭
        const hay = `${s.tip} ${s.tex} ${g.label} ${koExpand(s.tip)}`.toLowerCase()
        if (hay.includes(q)) out.push({ ...s, badge: g.label })
      }
    }
    for (const s of MATH_TEMPLATES2) {
      const hay = `${s.tip} ${s.tex} ${koExpand(s.tip)}`.toLowerCase()
      if (hay.includes(q)) out.push({ ...s, badge: '구조' })
    }
    for (const f of FORMULA_LIBRARY) {
      if (f.label.toLowerCase().includes(q) || f.field.toLowerCase().includes(q) || (f.alias || '').toLowerCase().includes(q) || f.tex.toLowerCase().includes(q)) {
        out.push({ tex: f.tex, tip: `${f.field} · ${f.label}`, badge: '공식' })
      }
    }
    for (const c of PHYSICAL_CONSTANTS) {
      if (c.label.toLowerCase().includes(q) || c.sym.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)) {
        out.push({ tex: c.value, tip: `상수 · ${c.label}`, badge: '상수' })
      }
    }
    return out.slice(0, 60)
  }, [deferredQuery])

  function pick(sym: Sym) {
    if (!taRef.current) return
    insertAtCursor(taRef.current, sym.tex, setLatex)
    pushRecent(sym)
    setRecent(loadRecent())
  }

  /** 자동완성 내비게이션 + Tab: 다음 □ 선택, Shift+Tab: 이전 □ */
  function onTaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc({ ...ac, sel: (ac.sel + 1) % ac.items.length }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc({ ...ac, sel: (ac.sel - 1 + ac.items.length) % ac.items.length }); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptAutocomplete(ac.items[ac.sel]); return }
    }
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
    if (tab === 'snippets') {
      const list = fieldFilter === '전체' ? FORMULA_LIBRARY : FORMULA_LIBRARY.filter((f) => f.field === fieldFilter)
      return list.map((f) => ({ tex: f.tex, tip: `${f.field} · ${f.label}`, badge: '공식' }))
    }
    if (tab === 'constants') return PHYSICAL_CONSTANTS.map((c) => ({ tex: c.value, tip: c.label, badge: '상수' }))
    return MATH_SYMBOL_GROUPS.find((g) => g.key === tab)?.items ?? []
  }, [tab, fieldFilter])

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
          <div className="jan-ms-input-wrap">
            <textarea
              ref={taRef}
              className="jan-ms-input"
              value={latex}
              onChange={(e) => { setLatex(e.target.value); updateAutocomplete(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
              onKeyDown={onTaKeyDown}
              onBlur={() => window.setTimeout(() => setAc(null), 150)}
              placeholder={'LaTeX 입력 — \\ 를 치면 자동완성, Tab 으로 □ 칸 이동, 예: \\frac \\ce{H2O}'}
              rows={3}
              spellCheck={false}
              aria-label="LaTeX 수식 입력"
            />
            {ac && (
              <div className="jan-ms-ac" role="listbox" aria-label="LaTeX 자동완성">
                {ac.items.map((it, i) => (
                  <button
                    key={it.tex}
                    type="button"
                    role="option"
                    aria-selected={i === ac.sel}
                    className={i === ac.sel ? 'is-sel' : ''}
                    onMouseDown={(e) => { e.preventDefault(); acceptAutocomplete(it) }}
                  >
                    <code>{it.tex.length > 28 ? it.tex.slice(0, 28) + '…' : it.tex}</code>
                    <span dangerouslySetInnerHTML={{ __html: renderKatex(it.tex, false) }} />
                    <small>{it.tip}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <button role="tab" aria-selected={tab === 'snippets'} className={tab === 'snippets' ? 'is-active' : ''} onClick={() => setTab('snippets')}>공식 {FORMULA_LIBRARY.length}</button>
              <button role="tab" aria-selected={tab === 'constants'} className={tab === 'constants' ? 'is-active' : ''} onClick={() => setTab('constants')}>상수</button>
            </div>
          )}
          {!searchResults && tab === 'snippets' && (
            <div className="jan-ms-fields" role="group" aria-label="분야 필터">
              {['전체', ...FORMULA_FIELDS].map((f) => (
                <button key={f} type="button" className={fieldFilter === f ? 'is-active' : ''} onClick={() => setFieldFilter(f)}>{f}</button>
              ))}
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
                <span className="jan-ms-sym-render" dangerouslySetInnerHTML={{ __html: renderKatex(s.tex, false) }} />
                {(tab === 'snippets' || tab === 'constants' || s.badge === '공식' || s.badge === '상수') && <small>{s.tip}</small>}
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

        {padOpen && (
          <div className="jan-ms-pad">
            <div className="jan-ms-pad-head">
              <strong>손글씨로 수식 쓰기</strong>
              <span>마우스/펜으로 크게 또박또박 — AI 가 LaTeX 로 변환합니다</span>
            </div>
            <canvas
              ref={padRef}
              width={760}
              height={220}
              className="jan-ms-pad-canvas"
              onPointerDown={padDown}
              onPointerMove={padMove}
              onPointerUp={padUp}
              onPointerLeave={padUp}
              style={{ touchAction: 'none' }}
              aria-label="손글씨 수식 입력 캔버스"
            />
            <div className="jan-ms-pad-foot">
              <button type="button" className="jan-ms-btn" onClick={padClear}>지우기</button>
              <span className="flex-spacer" />
              <button type="button" className="jan-ms-btn" onClick={() => setPadOpen(false)}>취소</button>
              <button type="button" className="jan-ms-btn jan-ms-btn-primary" onClick={padRecognize} disabled={aiBusy}>AI 인식</button>
            </div>
          </div>
        )}

        <div className="jan-ms-foot">
          <button type="button" className="jan-ms-btn" onClick={recognizeFromFile} disabled={aiBusy} title="수식 이미지(캡처·사진)를 LaTeX 로 변환 — AI 키 필요">
            {aiBusy ? '인식 중...' : '이미지 인식 (AI)'}
          </button>
          <button type="button" className="jan-ms-btn" onClick={() => setPadOpen((v) => !v)} disabled={aiBusy} title="손으로 쓴 수식을 LaTeX 로 변환 — AI 키 필요">손글씨 (AI)</button>
          <span className="jan-ms-note">Tab: 다음 □ 칸 · Esc: 닫기 · 선택 후 기호 클릭 = 감싸기</span>
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
