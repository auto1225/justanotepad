import { useEffect, useRef, useState } from 'react'
import { getGuide, type FeatureGuide } from '../lib/featureGuide'
import { HelpArt } from './HelpArt'

/**
 * 기능 설명 카드 — 아이콘에 마우스를 올리면 이름만이 아니라
 * "무엇을 하는지 · 언제 쓰는지 · 단축키"를 그림과 함께 보여 준다.
 *
 * 쓰는 쪽은 단추에 data-help="키" 만 붙이면 된다(featureGuide 의 키).
 * 이 컴포넌트는 앱에 한 번만 놓고 문서 전체의 hover/focus 를 지켜본다.
 */
const OPEN_DELAY = 380
const CLOSE_DELAY = 120
const CARD_W = 268

interface TipState {
  guide: FeatureGuide
  x: number
  y: number
  /** 화살표가 가리키는 x (카드 기준). 옆에 세운 카드는 -1 (화살표 없음) */
  arrowX: number
  /** 화살표가 붙는 쪽 — top: 카드 위, bottom: 카드 아래 */
  side: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * 따로 적어 둔 안내가 없는 단추(리본의 수백 개)는 요소가 들고 있는 정보로 카드를 만든다.
 * 이름 · 단축키 · 어느 묶음에 있는지 — 그것만으로도 "이게 뭐지" 는 풀린다.
 */
function fromElement(el: HTMLElement, key: string): FeatureGuide | null {
  if (!key.startsWith('ribbon:')) return null
  const label = key.slice('ribbon:'.length)
  const hint = el.getAttribute('data-help-hint') || undefined
  const group = el.getAttribute('data-help-group') || undefined
  // 설명이 붙어 있는 이름이면(예: "그림판 (그리기·손글씨·도형)") 괄호 안을 요약으로 쓴다
  const m = /^(.+?)\s*[（(]([^)）]+)[)）]\s*$/.exec(label)
  const title = m ? m[1].trim() : label
  const detail = m ? m[2].trim() : ''
  return {
    title,
    summary: detail || `${group ? group + ' 묶음의 ' : ''}${title} 기능입니다.`,
    when: group && detail ? `${group} 묶음에 있습니다.` : undefined,
    shortcut: hint,
  }
}

export function HelpTipLayer() {
  const [tip, setTip] = useState<TipState | null>(null)
  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    const clearTimers = () => {
      if (openTimer.current) { window.clearTimeout(openTimer.current); openTimer.current = null }
      if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null }
    }

    const show = (el: HTMLElement) => {
      const key = el.getAttribute('data-help')
      if (!key) return
      const guide = getGuide(key) || fromElement(el, key)
      if (!guide) return
      const r = el.getBoundingClientRect()
      const M = 8
      const CARD_H = guide.art ? 250 : 150 // 대략치 — 화면 밖으로 나갈지 판단하는 데만 쓴다

      // 메뉴·드롭다운 안의 항목이면 카드가 아래 항목들을 덮는다 → 목록 옆에 세운다
      const panel = el.closest('.jan-header-more-menu, .jan-ribbon-dropdown, .jan-menu, .jan-spin-pop') as HTMLElement | null
      if (panel) {
        const p = panel.getBoundingClientRect()
        const left = p.left - CARD_W - 10
        const right = p.right + 10
        const x = left >= M ? left : Math.min(right, window.innerWidth - CARD_W - M)
        const y = Math.max(M, Math.min(r.top - 8, window.innerHeight - CARD_H - M))
        setTip({ guide, x, y, arrowX: -1, side: left >= M ? 'left' : 'right' })
        return
      }

      const centered = r.left + r.width / 2 - CARD_W / 2
      const x = Math.max(M, Math.min(centered, window.innerWidth - CARD_W - M))
      // 아래로 넘치면 위로 뒤집는다
      const below = r.bottom + 8
      const flip = below + CARD_H > window.innerHeight - M && r.top - CARD_H - 8 > M
      const y = flip ? r.top - CARD_H - 8 : below
      setTip({ guide, x, y, arrowX: Math.max(14, Math.min(r.left + r.width / 2 - x, CARD_W - 14)), side: flip ? 'bottom' : 'top' })
    }

    const onOver = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-help]') as HTMLElement | null
      if (!el) return
      clearTimers()
      openTimer.current = window.setTimeout(() => show(el), OPEN_DELAY)
    }
    const onOut = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-help]')
      if (!el) return
      clearTimers()
      closeTimer.current = window.setTimeout(() => setTip(null), CLOSE_DELAY)
    }
    const onFocus = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-help]') as HTMLElement | null
      if (!el) return
      clearTimers()
      show(el) // 키보드 사용자는 기다리지 않는다
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearTimers(); setTip(null) } }
    const onDown = () => { clearTimers(); setTip(null) }

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('focusout', onOut, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    window.addEventListener('scroll', onDown, true)
    return () => {
      clearTimers()
      document.removeEventListener('mouseover', onOver, true)
      document.removeEventListener('mouseout', onOut, true)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('focusout', onOut, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('scroll', onDown, true)
    }
  }, [])

  if (!tip) return null
  const g = tip.guide

  return (
    <div
      className="jan-help-tip"
      role="tooltip"
      style={{ left: tip.x, top: tip.y, width: CARD_W }}
      onMouseEnter={() => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }}
      onMouseLeave={() => setTip(null)}
    >
      {tip.arrowX >= 0 && (
        <span className={'jan-help-arrow is-' + tip.side} style={{ left: tip.arrowX }} />
      )}
      {g.art && <HelpArt name={g.art} />}
      <div className="jan-help-body">
        <div className="jan-help-head">
          <strong className="jan-help-title">{g.title}</strong>
          {g.shortcut && <kbd className="jan-help-key">{g.shortcut}</kbd>}
        </div>
        <p className="jan-help-summary">{g.summary}</p>
        {g.when && (
          <p className="jan-help-when">
            <span className="jan-help-when-tag">이럴 때</span>
            {g.when}
          </p>
        )}
        {g.also && <p className="jan-help-also">함께 보기 · {g.also}</p>}
      </div>
    </div>
  )
}
