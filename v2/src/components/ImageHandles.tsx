import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { currentCrop, currentImage, setCrop, setImageAttrs, setRotation } from '../lib/imageWord'
import { flash } from '../lib/flash'

interface Props { editor: Editor | null }

interface Layout { left: number; top: number; width: number; height: number; rotate: number; locked: boolean }

type Corner = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const CORNERS: { key: Corner; x: number; y: number; cursor: string }[] = [
  { key: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { key: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { key: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { key: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { key: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { key: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { key: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { key: 'w', x: 0, y: 0.5, cursor: 'ew-resize' },
]

/**
 * 그림 손잡이 — 워드에서 그림을 고르면 둘레에 붙는 것들.
 *
 *  · 여덟 방향 손잡이: 끌면 크기가 바뀐다 (모서리는 비율 유지, 변은 그 축만)
 *  · 위쪽 동그란 손잡이: 끌면 회전한다 (Shift 를 누르면 15° 단위)
 *  · 자르기 모드에서는 같은 손잡이가 「자르는」 손잡이로 바뀐다
 *
 * 모두 마우스용 장식이다 — 같은 일을 Shift+방향키·Alt+방향키·리본·상황 메뉴로
 * 할 수 있으므로 보조기술에는 숨기고 탭 순서에서도 뺀다.
 */
export function ImageHandles({ editor }: Props) {
  const [layout, setLayout] = useState<Layout | null>(null)
  const shown = useRef(false)
  const [cropping, setCropping] = useState(false)
  const dragRef = useRef<{
    kind: 'size' | 'rotate' | 'crop'
    corner: Corner
    startX: number; startY: number
    startW: number; startH: number
    cx: number; cy: number
    baseCrop: { t: number; r: number; b: number; l: number }
    lock: boolean
    moved: boolean
    /* 끄는 동안 붙잡고 있는 그림의 자리.
       크기를 한 번 바꾸면 그림 노드가 새로 그려지고, 브라우저 커서가 그 자리를 잃으면서
       편집기가 글자 고름으로 되돌린다(문서도 안 바뀌고 이름표도 없는 트랜잭션이 그것이다).
       그러면 그다음 걸음부터는 「고른 그림」 이 없어 아무 일도 일어나지 않았다 —
       한 번 줄어들고 풀려 버리던 까닭이다. 그래서 고름에 기대지 않고 자리를 직접 붙든다. */
    pos: number
  } | null>(null)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) { setLayout(null); return }
    const sel = editor.state.selection
    const isNode = sel instanceof NodeSelection && sel.node.type.name === 'image'
    if (!isNode) { setLayout(null); setCropping(false); return }
    const hit = currentImage(editor)
    if (!hit) { setLayout(null); return }
    const dom = editor.view.nodeDOM(hit.pos)
    const el = dom instanceof HTMLElement ? (dom.tagName === 'IMG' ? dom : dom.querySelector('img')) : null
    if (!el) { setLayout(null); return }
    const box = (dom instanceof HTMLElement && dom.tagName !== 'IMG' ? dom : el).getBoundingClientRect()
    setLayout({
      left: box.left, top: box.top, width: box.width, height: box.height,
      rotate: Number(hit.node.attrs.rotate) || 0,
      locked: !!hit.node.attrs.locked,
    })
  }, [editor])

  /* 손잡이가 떠 있는지 — 그리는 중에 만지면 안 되므로 효과에서만 적어 둔다 */
  useEffect(() => { shown.current = layout != null }, [layout])

  useEffect(() => {
    if (!editor) return
    let raf = 0
    /* 그림을 고르지도 않았고 손잡이도 안 떠 있으면 프레임을 잡지 않는다 */
    const onChange = () => {
      const sel = editor.state.selection
      const onImage = sel instanceof NodeSelection && sel.node.type.name === 'image'
      if (!onImage && !shown.current) return
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(measure)
    }
    onChange()
    editor.on('selectionUpdate', onChange)
    editor.on('update', onChange)
    editor.on('transaction', onChange)
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    const onCrop = () => setCropping((v) => !v)
    window.addEventListener('jan-image-crop-mode', onCrop)
    return () => {
      window.cancelAnimationFrame(raf)
      editor.off('selectionUpdate', onChange)
      editor.off('update', onChange)
      editor.off('transaction', onChange)
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('jan-image-crop-mode', onCrop)
    }
  }, [editor, measure])

  useEffect(() => {
    if (!editor) return
    /* 문서가 바뀌면 붙잡은 자리도 함께 옮긴다 (쪽 나눔이 그림을 다른 쪽으로 보낼 수 있다) */
    const onTx = ({ transaction }: { transaction: { docChanged: boolean; mapping: { map: (p: number) => number } } }) => {
      const drag = dragRef.current
      if (drag && transaction.docChanged) drag.pos = transaction.mapping.map(drag.pos)
    }
    editor.on('transaction', onTx)

    /** 붙잡은 그림을 다시 고른 상태로 만든다 — 걸음마다 이것을 먼저 한다 */
    const hold = (drag: { pos: number }): boolean => {
      const node = editor.state.doc.nodeAt(drag.pos)
      if (!node || node.type.name !== 'image') return false
      const sel = editor.state.selection
      if (sel instanceof NodeSelection && sel.from === drag.pos) return true
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, drag.pos)))
      return true
    }

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (e.buttons === 0) { dragRef.current = null; return }
      if (!hold(drag)) { dragRef.current = null; return }
      drag.moved = true

      if (drag.kind === 'rotate') {
        const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI + 90
        const snapped = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle)
        setRotation(editor, snapped)
        return
      }

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY

      if (drag.kind === 'crop') {
        // 손잡이를 안쪽으로 끌면 그 변이 잘린다 (워드와 같은 느낌)
        const next = { ...drag.baseCrop }
        if (drag.corner.includes('w')) next.l = Math.min(0.9, Math.max(0, drag.baseCrop.l + dx / drag.startW))
        if (drag.corner.includes('e')) next.r = Math.min(0.9, Math.max(0, drag.baseCrop.r - dx / drag.startW))
        if (drag.corner.includes('n')) next.t = Math.min(0.9, Math.max(0, drag.baseCrop.t + dy / drag.startH))
        if (drag.corner.includes('s')) next.b = Math.min(0.9, Math.max(0, drag.baseCrop.b - dy / drag.startH))
        if (next.l + next.r < 0.95 && next.t + next.b < 0.95) setCrop(editor, next)
        return
      }

      // 크기 — 모서리는 비율을 지키고, 변 손잡이는 그 축만 늘린다
      let w = drag.startW
      let h = drag.startH
      if (drag.corner.includes('e')) w = drag.startW + dx
      if (drag.corner.includes('w')) w = drag.startW - dx
      if (drag.corner.includes('s')) h = drag.startH + dy
      if (drag.corner.includes('n')) h = drag.startH - dy
      w = Math.max(24, Math.round(w))
      h = Math.max(24, Math.round(h))
      const vertical = drag.corner === 'n' || drag.corner === 's'
      if (drag.lock || !e.altKey) {
        // 비율 고정: 세로 손잡이는 높이로, 나머지는 너비로 크기를 정한다
        if (vertical) {
          const ratio = drag.startW / Math.max(1, drag.startH)
          setImageAttrs(editor, { width: `${Math.round(h * ratio)}px`, height: null })
        } else {
          setImageAttrs(editor, { width: `${w}px`, height: null })
        }
      } else {
        setImageAttrs(editor, { width: `${w}px`, height: `${h}px` })
      }
    }
    const onUp = () => {
      const drag = dragRef.current
      dragRef.current = null
      /* 놓고 나서도 그림은 고른 채로 둔다 — 워드·한글과 같다.
         바로 이어서 더 끌거나 리본으로 값을 다듬는 것이 보통이다. */
      if (drag && drag.moved) hold(drag)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      editor.off('transaction', onTx)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [editor])

  if (!editor || !layout) return null

  function start(e: React.MouseEvent, corner: Corner) {
    e.preventDefault()
    e.stopPropagation()
    if (!layout) return
    if (layout.locked) { flash('개체 보호가 걸려 있다 — Alt+L 로 푼다'); return }
    const hit = currentImage(editor)
    dragRef.current = {
      kind: cropping ? 'crop' : 'size',
      corner,
      startX: e.clientX, startY: e.clientY,
      startW: layout.width, startH: layout.height,
      cx: layout.left + layout.width / 2, cy: layout.top + layout.height / 2,
      baseCrop: currentCrop(editor),
      lock: hit ? hit.node.attrs.lock !== false : true,
      pos: hit ? hit.pos : -1,
      moved: false,
    }
  }

  function startRotate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!layout) return
    if (layout.locked) { flash('개체 보호가 걸려 있다 — Alt+L 로 푼다'); return }
    dragRef.current = {
      kind: 'rotate', corner: 'n',
      startX: e.clientX, startY: e.clientY,
      startW: layout.width, startH: layout.height,
      cx: layout.left + layout.width / 2, cy: layout.top + layout.height / 2,
      baseCrop: currentCrop(editor), lock: true, moved: false,
      pos: currentImage(editor)?.pos ?? -1,
    }
  }

  return (
    <div className="jan-img-handles" aria-hidden="true">
      <div
        className={`jan-ih-frame${cropping ? ' is-crop' : ''}`}
        style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
      />
      {CORNERS.map((c) => (
        <button
          key={c.key}
          tabIndex={-1}
          className={`jan-ih-dot${cropping ? ' is-crop' : ''}`}
          style={{
            left: layout.left + layout.width * c.x,
            top: layout.top + layout.height * c.y,
            cursor: c.cursor,
          }}
          onMouseDown={(e) => start(e, c.key)}
          title={cropping ? '끌어서 자르기' : '끌어서 크기 조절 (Alt 를 누르면 비율 무시)'}
        />
      ))}
      <button
        tabIndex={-1}
        className="jan-ih-rotate"
        style={{ left: layout.left + layout.width / 2, top: layout.top - 26 }}
        onMouseDown={startRotate}
        title="끌어서 회전 (Shift 를 누르면 15° 단위)"
      >⟳</button>
      {cropping && (
        <div className="jan-ih-tip" style={{ left: layout.left, top: layout.top + layout.height + 8 }}>
          자르기 — 손잡이를 안쪽으로 끌어라. 끝내려면 Esc, 되돌리려면 Alt+X
        </div>
      )}
    </div>
  )
}
