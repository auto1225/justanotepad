import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { CellSelection } from 'prosemirror-tables'
import { applyBorders, applyShading } from '../lib/tableBorders'
import { cellSelectionSize } from '../lib/tableSelect'
import { distributeColumns, distributeRows } from '../lib/tableWord'
import { fitImageToBody, rotateImage } from '../lib/imageWord'
import { rotateShape } from '../lib/shapeWord'

interface Props { editor: Editor | null }

type Kind = 'table' | 'image' | 'shape'

interface Spot { kind: Kind; left: number; top: number; label: string }

/**
 * 개체 상황 막대 — 표·그림·도형을 고르면 그 개체에 바로 쓸 것들이 뜬다.
 *
 * 워드의 미니 도구 모음과 같은 자리다. 리본까지 가지 않고 손이 있는 곳에서
 * 테두리·채우기·맞춤을 끝낸다.
 * 개체를 가리지 않도록 늘 개체 **위쪽 바깥**에 놓는다 (덮으면 다음 칸을 못 누른다).
 */
export function ObjectBar({ editor }: Props) {
  const [spot, setSpot] = useState<Spot | null>(null)
  const showing = useRef(false)

  /* 막대가 떠 있는지 — 그리는 중에 만지면 안 되므로 효과에서만 적어 둔다 */
  useEffect(() => { showing.current = spot != null }, [spot])

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) { setSpot(null); return }
    const sel = editor.state.selection
    try {
      if (sel instanceof CellSelection) {
        const dom = editor.view.domAtPos(sel.$anchorCell.pos + 1).node as HTMLElement | null
        const el = dom?.nodeType === 1 ? (dom as HTMLElement) : dom?.parentElement
        const table = el?.closest?.('table')
        if (!table) { setSpot(null); return }
        const box = table.getBoundingClientRect()
        const size = cellSelectionSize(editor)
        setSpot({
          kind: 'table',
          left: box.left,
          /* 표 손잡이 띠(위쪽 열 선택 띠)보다 더 위에 둔다 —
             겹치면 열을 고르려고 누른 손이 막대에 막힌다 */
          top: Math.max(box.top - 58, 8),
          label: size ? `${size.rows}행 ${size.cols}열` : '표',
        })
        return
      }
      if (sel instanceof NodeSelection && (sel.node.type.name === 'image' || sel.node.type.name === 'janShape')) {
        const dom = editor.view.nodeDOM(sel.from)
        const el = dom instanceof HTMLElement ? dom : null
        if (!el) { setSpot(null); return }
        const box = el.getBoundingClientRect()
        setSpot({
          kind: sel.node.type.name === 'image' ? 'image' : 'shape',
          left: box.left,
          top: Math.max(box.top - 40, 8),
          label: sel.node.type.name === 'image' ? '그림' : '도형',
        })
        return
      }
      setSpot(null)
    } catch {
      setSpot(null)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    let raf = 0
    /* 개체를 고르지도 않았고 막대도 안 떠 있으면 아무것도 하지 않는다 —
       글을 고칠 때마다 프레임을 잡으면 무거운 서식에서 화면이 더뎌진다 */
    const worthIt = () => {
      const sel = editor.state.selection
      return sel instanceof CellSelection
        || (sel instanceof NodeSelection && (sel.node.type.name === 'image' || sel.node.type.name === 'janShape'))
    }
    const onChange = () => {
      if (!worthIt() && !showing.current) return
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(measure)
    }
    onChange()
    editor.on('selectionUpdate', onChange)
    editor.on('transaction', onChange)
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    return () => {
      window.cancelAnimationFrame(raf)
      editor.off('selectionUpdate', onChange)
      editor.off('transaction', onChange)
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
    }
  }, [editor, measure])

  if (!editor || !spot) return null

  const fire = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }))
  const chain = () => editor.chain().focus()

  return (
    <div
      className="jan-object-bar"
      style={{ position: 'fixed', left: spot.left, top: spot.top, zIndex: 610 }}
      onMouseDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label={`${spot.label} 도구`}
    >
      <span className="jan-object-bar-tag">{spot.label}</span>

      {spot.kind === 'table' && (
        <>
          <button onClick={() => applyBorders(editor, 'all')} title="모든 테두리 (쥔 펜으로)">모든 선</button>
          <button onClick={() => applyBorders(editor, 'outer')} title="바깥쪽 테두리">바깥</button>
          <button onClick={() => applyBorders(editor, 'none')} title="테두리 없음">선 없음</button>
          <button onClick={() => fire('jan-table-format', { tab: 'border' })} title="선 색·두께·모양 정하기">선 모양...</button>
          <span className="divider" />
          <button className="jan-object-bar-swatch" style={{ background: '#fef0c7' }} onClick={() => applyShading(editor, '#fef0c7')} title="노랑으로 채우기" aria-label="노랑으로 채우기" />
          <button className="jan-object-bar-swatch" style={{ background: '#d1e9ff' }} onClick={() => applyShading(editor, '#d1e9ff')} title="파랑으로 채우기" aria-label="파랑으로 채우기" />
          <button className="jan-object-bar-swatch" style={{ background: '#f2f4f7' }} onClick={() => applyShading(editor, '#f2f4f7')} title="회색으로 채우기" aria-label="회색으로 채우기" />
          <button onClick={() => fire('jan-table-format', { tab: 'fill' })} title="다른 색으로 채우기">채우기...</button>
          <span className="divider" />
          <button onClick={() => fire('jan-table-format', { tab: 'align' })} title="맞춤·칸 여백·들여쓰기">맞춤...</button>
          <span className="divider" />
          <button onClick={() => chain().addRowAfter().run()} title="아래에 행 넣기 (Alt+I)">행＋</button>
          <button onClick={() => chain().addColumnAfter().run()} title="오른쪽에 열 넣기 (Alt+O)">열＋</button>
          <button onClick={() => chain().deleteRow().run()} title="행 지우기">행－</button>
          <button onClick={() => chain().deleteColumn().run()} title="열 지우기">열－</button>
          <button onClick={() => chain().mergeCells().run()} title="칸 합치기 (Alt+M)">합치기</button>
          <button onClick={() => { distributeColumns(editor) }} title="열 너비를 같게 (Alt+E)">열 같게</button>
          <button onClick={() => { distributeRows(editor) }} title="행 높이를 같게 (Alt+Shift+E)">행 같게</button>
        </>
      )}

      {spot.kind === 'image' && (
        <>
          <button onClick={() => fitImageToBody(editor)} title="본문 너비에 맞춤 (Alt+F)">폭 맞춤</button>
          <button onClick={() => rotateImage(editor, 90)} title="오른쪽으로 90° 회전 (Alt+R)">⟳</button>
          <button onClick={() => fire('jan-image-crop-mode')} title="자르기">자르기</button>
          <button onClick={() => fire('jan-image-dialog', { tab: 'layout' })} title="텍스트 배치 (Alt+W)">배치...</button>
          <button onClick={() => fire('jan-image-dialog', { tab: 'adjust' })} title="색 보정 (Alt+T)">보정...</button>
          <button onClick={() => fire('jan-image-dialog', { tab: 'caption' })} title="캡션 (Alt+C)">캡션...</button>
          <button onClick={() => fire('jan-image-dialog', { tab: 'size' })} title="크기·위치 (Alt+P)">속성...</button>
        </>
      )}

      {spot.kind === 'shape' && (
        <>
          <button onClick={() => rotateShape(editor, 90)} title="오른쪽으로 90° 회전 (Alt+R)">⟳</button>
          <button onClick={() => fire('jan-shape-dialog', { mode: 'format' })} title="채우기·선·글자 (Alt+P)">서식...</button>
          <button onClick={() => fire('jan-shape-dialog', { mode: 'insert' })} title="다른 도형으로 바꾸기">모양...</button>
        </>
      )}

      <span className="divider" />
      <button onClick={() => editor.chain().focus().deleteSelection().run()} title="지우기" aria-label="지우기">✕</button>
    </div>
  )
}
