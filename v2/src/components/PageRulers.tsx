import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * 페이지 눈금자 — 워드·한글과 같은 방식.
 *
 * - 자의 눈금은 "그 용지의 위치"를 가리킨다. 세로 자는 용지와 함께 스크롤되며
 *   쪽마다 하나씩 놓여 0 이 그 쪽의 맨 위와 맞는다 (화면에 붙여 두면 몇 mm 인지 알 수 없다).
 * - 여백 구간은 회색, 본문 구간은 흰색으로 칠해 여백이 한눈에 보인다.
 * - 가로 자에는 첫 줄·왼쪽·오른쪽 들여쓰기 손잡이가 있고 끌어서 바꾼다.
 */

const MM_PER_IN = 25.4
const PX_PER_IN = 96
export const mmToPx = (mm: number) => (mm * PX_PER_IN) / MM_PER_IN
export const pxToMm = (px: number) => (px * MM_PER_IN) / PX_PER_IN

/** 1cm 간격 숫자 + 5mm 보조 눈금 */
function ticksOf(lengthMm: number) {
  const ticks: Array<{ mm: number; kind: 'cm' | 'half' }> = []
  for (let mm = 5; mm < lengthMm; mm += 5) {
    ticks.push({ mm, kind: mm % 10 === 0 ? 'cm' : 'half' })
  }
  return ticks
}

interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

/** 현재 문단의 들여쓰기 값(px) — 커서를 옮길 때마다 갱신 */
function useParagraphIndent(editor: Editor | null) {
  const [state, setState] = useState({ indent: 0, firstLine: 0, indentRight: 0 })
  useEffect(() => {
    if (!editor) return
    const read = () => {
      const a = editor.getAttributes('paragraph')
      const h = editor.getAttributes('heading')
      const attrs = Object.keys(a).length ? a : h
      setState({
        indent: ((attrs.indent as number) || 0) * 24,
        firstLine: (attrs.firstLine as number) || 0,
        indentRight: (attrs.indentRight as number) || 0,
      })
    }
    read()
    editor.on('selectionUpdate', read)
    editor.on('transaction', read)
    return () => {
      editor.off('selectionUpdate', read)
      editor.off('transaction', read)
    }
  }, [editor])
  return state
}

type Handle = 'first' | 'left' | 'right'

export function HorizontalRuler({
  widthMm,
  margins,
  editor,
}: {
  widthMm: number
  margins: Margins
  editor: Editor | null
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const indent = useParagraphIndent(editor)
  const [drag, setDrag] = useState<{ handle: Handle; px: number } | null>(null)

  const contentMm = Math.max(1, widthMm - margins.left - margins.right)
  const pct = (mm: number) => (mm / widthMm) * 100

  /** 손잡이 위치(용지 왼쪽 끝 기준 mm) */
  const handleMm = useCallback(
    (handle: Handle) => {
      const live = drag?.handle === handle ? drag.px : null
      if (handle === 'right') {
        const px = live ?? indent.indentRight
        return widthMm - margins.right - pxToMm(px)
      }
      const base = margins.left + pxToMm(live ?? indent.indent)
      if (handle === 'left') return base
      return base + pxToMm(drag?.handle === 'first' ? drag.px : indent.firstLine)
    },
    [drag, indent, margins.left, margins.right, widthMm]
  )

  const startDrag = (handle: Handle) => (e: React.PointerEvent) => {
    if (!editor) return
    e.preventDefault()
    e.stopPropagation()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const scale = rect.width / mmToPx(widthMm) || 1
    const toValuePx = (clientX: number) => {
      const mmFromLeft = pxToMm((clientX - rect.left) / scale)
      if (handle === 'right') return mmToPx(Math.max(0, widthMm - margins.right - mmFromLeft))
      const fromTextLeft = mmToPx(mmFromLeft - margins.left)
      if (handle === 'left') return Math.max(0, fromTextLeft)
      return fromTextLeft - indent.indent // 첫 줄은 왼쪽 들여쓰기 기준 상대값
    }
    const move = (ev: PointerEvent) => setDrag({ handle, px: toValuePx(ev.clientX) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const px = toValuePx(ev.clientX)
      setDrag(null)
      const chain = editor.chain().focus()
      if (handle === 'left') chain.setParagraphIndentPx(px).run()
      else if (handle === 'first') chain.setParagraphFirstLine(px).run()
      else chain.setParagraphIndentRight(px).run()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    setDrag({ handle, px: toValuePx(e.clientX) })
  }

  const ticks = useMemo(() => ticksOf(widthMm), [widthMm])

  return (
    <div className="jan-ruler jan-ruler-h" role="img" aria-label={`가로 눈금자 ${Math.round(widthMm)}mm`}>
      <div className="jan-ruler-track" ref={trackRef}>
        {/* 여백 구간(회색) — 본문이 놓이는 구간만 희게 남는다 */}
        <span className="jan-ruler-pad" style={{ left: 0, width: `${pct(margins.left)}%` }} />
        <span className="jan-ruler-pad" style={{ right: 0, width: `${pct(margins.right)}%` }} />
        {ticks.map((t) => (
          <span
            key={t.mm}
            className={`jan-ruler-tick is-${t.kind}`}
            style={{ left: `${pct(t.mm)}%` }}
            aria-hidden="true"
          >
            {t.kind === 'cm' && <em>{t.mm / 10}</em>}
          </span>
        ))}
        {/* 들여쓰기 손잡이 — 끌어서 현재 문단의 여백을 바꾼다 */}
        <button
          type="button"
          className={'jan-ruler-grip is-first' + (drag?.handle === 'first' ? ' is-dragging' : '')}
          style={{ left: `${pct(handleMm('first'))}%` }}
          onPointerDown={startDrag('first')}
          title="첫 줄 들여쓰기 — 끌어서 조절"
          aria-label="첫 줄 들여쓰기"
        />
        <button
          type="button"
          className={'jan-ruler-grip is-left' + (drag?.handle === 'left' ? ' is-dragging' : '')}
          style={{ left: `${pct(handleMm('left'))}%` }}
          onPointerDown={startDrag('left')}
          title="왼쪽 들여쓰기 — 끌어서 조절"
          aria-label="왼쪽 들여쓰기"
        />
        <button
          type="button"
          className={'jan-ruler-grip is-right' + (drag?.handle === 'right' ? ' is-dragging' : '')}
          style={{ left: `${pct(handleMm('right'))}%` }}
          onPointerDown={startDrag('right')}
          title="오른쪽 들여쓰기 — 끌어서 조절"
          aria-label="오른쪽 들여쓰기"
        />
      </div>
      <span className="jan-ruler-cap" aria-hidden="true">
        {Math.round(contentMm)}mm
      </span>
    </div>
  );
}

/**
 * 세로 눈금자 — 쪽마다 하나. 용지와 같은 높이·같은 간격으로 쌓아 두면
 * 스크롤해도 용지와 어긋나지 않고, 각 쪽의 0mm 가 그 쪽 맨 위와 맞는다.
 */
export function VerticalRulers({
  heightMm,
  margins,
  pageCount,
  gapPx,
}: {
  heightMm: number
  margins: Margins
  pageCount: number
  gapPx: number
}) {
  const ticks = useMemo(() => ticksOf(heightMm), [heightMm])
  const pct = (mm: number) => (mm / heightMm) * 100
  return (
    <div className="jan-ruler-vstack" style={{ gap: `${gapPx}px` }} aria-hidden="true">
      {Array.from({ length: Math.max(1, pageCount) }, (_, i) => (
        <div className="jan-ruler jan-ruler-v" key={i} role="img" aria-label={`${i + 1}쪽 세로 눈금자`}>
          <div className="jan-ruler-track">
            <span className="jan-ruler-pad" style={{ top: 0, height: `${pct(margins.top)}%` }} />
            <span className="jan-ruler-pad" style={{ bottom: 0, height: `${pct(margins.bottom)}%` }} />
            {ticks.map((t) => (
              <span key={t.mm} className={`jan-ruler-tick is-${t.kind}`} style={{ top: `${pct(t.mm)}%` }}>
                {t.kind === 'cm' && <em>{t.mm / 10}</em>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
