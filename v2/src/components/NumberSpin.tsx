import { useEffect, useId, useRef, useState } from 'react'

/**
 * 숫자 입력 + 증감 단추 — 한글·워드의 서식 도구 상자와 같은 조작.
 *
 *  - 직접 입력하고 Enter 또는 포커스가 떠날 때 적용
 *  - ▲▼ 단추, 키보드 ↑↓, 마우스 휠(포커스가 있을 때)로 step 만큼 증감
 *  - Shift 를 누르면 큰 걸음(step × 10)
 *  - 값을 따로 주지 않은 상태(문서 기본값을 따름)면 그 기본값을 흐리게 보여 준다
 *  - 자주 쓰는 값은 ▾ 목록에서 고른다
 *    (브라우저 기본 datalist 는 입력칸 위를 덮고 화살표가 겹쳐 쓰지 않는다)
 */
export interface NumberSpinProps {
  value: number | null
  /** keepFocus 가 true 면 입력칸에 포커스를 남긴다 (↑↓·휠로 연달아 조절할 때) */
  onChange: (v: number | null, opts?: { keepFocus?: boolean }) => void
  min: number
  max: number
  step?: number
  /** 소수 자릿수 — 줄간격처럼 0.05 단위면 2 */
  decimals?: number
  /** 입력칸 오른쪽에 붙는 단위 표시 (pt, % …) */
  unit?: string
  title: string
  ariaLabel: string
  width?: number
  /** 값을 지웠을 때(빈칸 + Enter) null 로 알린다 — 기본값으로 되돌리기 */
  allowEmpty?: boolean
  /** ▾ 목록에 넣을 자주 쓰는 값 */
  presets?: number[]
  /**
   * 값이 없을 때 보여 줄 현재 실제 값(문서 기본값). 증감의 기준으로도 쓴다.
   * 워드처럼 "지금 적용돼 있는 값"이 늘 보이게 하려는 것.
   */
  inherited?: number
}

export function NumberSpin({
  value, onChange, min, max, step = 1, decimals = 0, unit, title, ariaLabel,
  width = 46, allowEmpty = true, presets, inherited,
}: NumberSpinProps) {
  const fmt = (v: number) => (decimals > 0 ? v.toFixed(decimals).replace(/\.?0+$/, '') : String(Math.round(v)))
  // 입력 중일 때만 draft 를 들고, 아니면 바깥 값을 그대로 보여 준다 (동기화 effect 가 필요 없다)
  const [draft, setDraft] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const isInherited = value == null && inherited != null
  const shown = draft ?? (value != null ? fmt(value) : inherited != null ? fmt(inherited) : '')
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLSpanElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!listOpen) return
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setListOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [listOpen])

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const round = (v: number) => Number(v.toFixed(decimals))

  const commit = (raw: string) => {
    const t = raw.trim()
    setDraft(null)
    if (!t) {
      if (allowEmpty) onChange(null)
      return
    }
    const n = Number(t.replace(/[^\d.-]/g, ''))
    if (Number.isNaN(n)) return
    onChange(round(clamp(n)))
  }

  const bump = (dir: 1 | -1, big = false, keepFocus = false) => {
    const base = value ?? inherited ?? min
    setDraft(null)
    onChange(round(clamp(base + dir * step * (big ? 10 : 1))), { keepFocus })
  }

  return (
    <span className={'jan-spin' + (isInherited ? ' is-inherited' : '')} title={title} ref={boxRef}>
      <input
        ref={inputRef}
        className="jan-spin-input"
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={shown}
        style={{ width }}
        onChange={(e) => setDraft(e.target.value)}
        /* Enter 로 이미 적용했으면(draft 가 비워짐) 다시 적용하지 않는다 —
           적용 직후에는 편집기로 포커스가 옮겨가며 blur 가 뒤따르는데,
           그때 입력칸은 아직 새 값을 못 받았을 수 있어 빈 값으로 되돌리는 사고가 난다 */
        onBlur={(e) => { if (draft !== null) commit(e.target.value) }}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value) }
          // ↑↓ 는 입력칸에 머물러야 연달아 누를 수 있다 (한글·워드와 같다)
          else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1, e.shiftKey, true) }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1, e.shiftKey, true) }
          else if (e.key === 'Escape') { e.preventDefault(); setDraft(null); setListOpen(false); inputRef.current?.blur() }
          e.stopPropagation()
        }}
        onWheel={(e) => {
          if (document.activeElement !== inputRef.current) return
          bump(e.deltaY < 0 ? 1 : -1, e.shiftKey, true)
        }}
      />
      {unit ? <span className="jan-spin-unit">{unit}</span> : null}
      {presets?.length ? (
        <button
          type="button"
          className="jan-spin-list"
          tabIndex={-1}
          aria-label={`${ariaLabel} 자주 쓰는 값`}
          aria-expanded={listOpen}
          aria-controls={listId}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setListOpen((v) => !v)}
        >
          <svg viewBox="0 0 8 5" width="7" height="5" aria-hidden="true"><path d="M4 5 0 0h8z" fill="currentColor" /></svg>
        </button>
      ) : null}
      <span className="jan-spin-btns">
        <button type="button" tabIndex={-1} aria-label={`${ariaLabel} 늘리기`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => bump(1, e.shiftKey)}>
          <svg viewBox="0 0 8 5" width="7" height="4" aria-hidden="true"><path d="M4 0 8 5H0z" fill="currentColor" /></svg>
        </button>
        <button type="button" tabIndex={-1} aria-label={`${ariaLabel} 줄이기`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => bump(-1, e.shiftKey)}>
          <svg viewBox="0 0 8 5" width="7" height="4" aria-hidden="true"><path d="M4 5 0 0h8z" fill="currentColor" /></svg>
        </button>
      </span>

      {listOpen && presets?.length ? (
        <div className="jan-spin-pop" id={listId} role="listbox" aria-label={`${ariaLabel} 목록`}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={value === p}
              className={'jan-spin-pop-item' + (value === p ? ' is-active' : '')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setListOpen(false); setDraft(null); onChange(round(clamp(p))) }}
            >
              {fmt(p)}{unit ? <span className="jan-spin-pop-unit">{unit}</span> : null}
            </button>
          ))}
          {allowEmpty && (
            <button
              type="button"
              className="jan-spin-pop-item jan-spin-pop-reset"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setListOpen(false); setDraft(null); onChange(null) }}
            >
              기본값으로
            </button>
          )}
        </div>
      ) : null}
    </span>
  )
}
