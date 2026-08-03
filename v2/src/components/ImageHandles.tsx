import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { currentCrop, currentImage, imageBoxEl, setCrop, setImageAttrs, setRotation } from '../lib/imageWord'
import { parseCrop } from '../extensions/ImageObject'
import { flash } from '../lib/flash'

interface Props { editor: Editor | null }

/** 자르기 미리보기 — 잘려 나간 부분까지 포함한 그림 전체의 자리와 주소 */
interface Ghost { src: string; left: number; top: number; width: number; height: number }

interface Layout { left: number; top: number; width: number; height: number; rotate: number; locked: boolean; ghost: Ghost | null }

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
  /* 자르기를 끝낼지 재는 시계.
     크기·자르기 값을 줄 때마다 그림 노드가 새로 그려지는데, 그 찰나에 브라우저 커서가
     자리를 잃어 고름이 글자 고름으로 떨어진다. 그것만 보고 자르기를 끝내 버리면
     한 번 끌 때마다 자르기가 저절로 풀린다 — 자르기는 보통 여러 번 끌어 맞추는 일이다.
     그래서 그림에서 손을 뗀 상태가 잠깐이 아니라 이어질 때만 끝낸다. */
  const cropOff = useRef<number | undefined>(undefined)
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
    /**
     * 어느 그림을 재는가 — 끄는 동안에는 고름에 묻지 않고 붙잡아 둔 자리를 쓴다.
     *
     * 무거운 문서에서 자르기 손잡이가 한 걸음마다 통째로 사라졌다. 자르기 값을 한 번
     * 바꿀 때 두 가지가 잇따라 고름을 떨어뜨린다. 트랜잭션을 찍어 보면 이렇다.
     *   NodeSelection 940 → TextSelection 936   (readDOMChange — 그림 노드가 맨 img 에서
     *     잘라 내는 span 세 겹으로 다시 그려지자 편집기의 DOM 감시기가 그것을 사람이
     *     고친 것으로 읽고 브라우저 커서 자리로 고름을 되돌린다)
     *   TextSelection 934 → 691 → 689           (PageDocument.reflowOnce — 상자가 줄어
     *     쪽 나눔이 돌며 고름을 딴 쪽으로 옮긴다)
     * 다음 걸음의 hold() 가 고름을 되돌려 놓으므로 자르기 자체는 먹었지만, 그 사이
     * 이 함수가 손잡이와 미리보기를 걷어 버려 끄는 내내 깜빡였다.
     *
     * 자리는 이미 붙들고 있다(dragRef.pos — 문서가 바뀌면 함께 옮겨 준다).
     * 끄는 동안에는 그것만 믿는다. 크기 조절도 같은 길을 타므로 함께 낫는다.
     */
    const drag = dragRef.current
    const sel = editor.state.selection
    let pos = -1
    if (drag && drag.pos >= 0 && editor.state.doc.nodeAt(drag.pos)?.type.name === 'image') pos = drag.pos
    else if (sel instanceof NodeSelection && sel.node.type.name === 'image') pos = sel.from
    if (pos < 0) {
      setLayout(null)
      /* 잠깐 풀린 것인지 정말 딴 데로 간 것인지 조금 기다려 본다 */
      if (cropOff.current === undefined) {
        cropOff.current = window.setTimeout(() => { cropOff.current = undefined; setCropping(false) }, 500)
      }
      return
    }
    if (cropOff.current !== undefined) { window.clearTimeout(cropOff.current); cropOff.current = undefined }
    const node = editor.state.doc.nodeAt(pos)
    if (!node) { setLayout(null); return }
    /* 자른 그림은 안쪽 img 가 상자보다 크고, 캡션이 붙은 그림은 바깥 span 이 더 크다 —
       손잡이는 보이는 상자에 붙어야 하므로 그 요소를 따로 찾는다 */
    const box = imageBoxEl(editor, pos)?.getBoundingClientRect()
    if (!box) { setLayout(null); return }

    /* 자르는 동안에는 잘려 나가는 부분을 흐리게 비춰 준다 (워드의 자르기 미리보기).
       상자 안에 든 그림은 상자의 1/kw · 1/kh 배이고, 잘라 낸 몫만큼 왼쪽·위로 나가 있다. */
    let ghost: Ghost | null = null
    if (cropping) {
      const dom = editor.view.nodeDOM(pos)
      const el = dom instanceof HTMLElement ? (dom.tagName === 'IMG' ? dom : dom.querySelector('img')) : null
      const src = el ? (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src : ''
      const crop = parseCrop(node.attrs.crop) || { t: 0, r: 0, b: 0, l: 0 }
      const kw = Math.max(0.05, 1 - crop.l - crop.r)
      const kh = Math.max(0.05, 1 - crop.t - crop.b)
      if (src && !src.startsWith('data:image/gif')) {
        const width = box.width / kw
        const height = box.height / kh
        ghost = { src, width, height, left: box.left - crop.l * width, top: box.top - crop.t * height }
      }
    }

    setLayout({
      left: box.left, top: box.top, width: box.width, height: box.height,
      rotate: Number(node.attrs.rotate) || 0,
      locked: !!node.attrs.locked,
      ghost,
    })
  }, [editor, cropping])

  /* 손잡이가 떠 있는지 — 그리는 중에 만지면 안 되므로 효과에서만 적어 둔다 */
  useEffect(() => { shown.current = layout != null }, [layout])

  useEffect(() => {
    if (!editor) return
    let raf = 0
    /* 그림을 고르지도 않았고 손잡이도 안 떠 있으면 프레임을 잡지 않는다.
       (끄는 중이면 고름이 잠깐 떨어져도 계속 잰다 — 손잡이가 사라지면 안 되므로) */
    const onChange = () => {
      const sel = editor.state.selection
      const onImage = sel instanceof NodeSelection && sel.node.type.name === 'image'
      if (!onImage && !shown.current && !dragRef.current) return
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
      if (cropOff.current !== undefined) window.clearTimeout(cropOff.current)
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
        /* 손잡이를 안쪽으로 끌면 그 변이 잘린다 (워드와 같은 느낌).
           자르기 값은 「원본에 대한 몫」 이라 화면에서 움직인 거리를 상자가 아니라
           **잘리기 전 그림 전체**의 크기로 나눠야 한다. 상자로 나누면 이미 잘린
           그림에서 손이 간 거리보다 훨씬 크게 잘려 손잡이가 커서에서 달아난다.
           자르는 동안 그림의 배율은 그대로이므로 이 크기는 끄는 내내 변하지 않는다. */
        const fullW = drag.startW
        const fullH = drag.startH
        const next = { ...drag.baseCrop }
        if (drag.corner.includes('w')) next.l = Math.min(0.9, Math.max(0, drag.baseCrop.l + dx / fullW))
        if (drag.corner.includes('e')) next.r = Math.min(0.9, Math.max(0, drag.baseCrop.r - dx / fullW))
        if (drag.corner.includes('n')) next.t = Math.min(0.9, Math.max(0, drag.baseCrop.t + dy / fullH))
        if (drag.corner.includes('s')) next.b = Math.min(0.9, Math.max(0, drag.baseCrop.b - dy / fullH))
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
      {/* 자르기 미리보기 — 잘려 나가는 부분은 흐리게, 남는 부분은 또렷하게 (워드와 같다).
          흐린 그림 한 장을 통째로 깔고, 남는 만큼만 다시 또렷하게 덮는다. 흐린 것만
          깔면 남는 부분까지 함께 흐려져 무엇이 남는지 보이지 않는다. */}
      {layout.ghost && (
        <>
          <img
            className="jan-ih-ghost" src={layout.ghost.src} alt=""
            style={{ left: layout.ghost.left, top: layout.ghost.top, width: layout.ghost.width, height: layout.ghost.height }}
          />
          <div className="jan-ih-keep" style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}>
            <img
              src={layout.ghost.src} alt=""
              style={{
                left: layout.ghost.left - layout.left, top: layout.ghost.top - layout.top,
                width: layout.ghost.width, height: layout.ghost.height,
              }}
            />
          </div>
        </>
      )}
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
