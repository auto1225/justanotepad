import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  findTable,
  moveTable,
  selectTableColumn,
  selectTableRow,
  selectWholeTable,
  setTableWidthPercent,
} from '../lib/tableSelect'
import { flash } from '../lib/flash'

interface TableHandlesProps {
  editor: Editor | null
}

interface Rect { left: number; top: number; width: number; height: number }

interface Layout {
  table: Rect
  /** 표가 놓인 자리의 폭 (백분율 계산 기준) */
  hostWidth: number
  cols: Array<{ left: number; width: number }>
  rows: Array<{ top: number; height: number }>
}

const HANDLE = 14

/**
 * 표 손잡이 — 워드에서 표 둘레에 붙는 것들.
 *
 *  · 왼쪽 위 이동 손잡이: 누르면 표 전체 선택, 위아래로 끌면 표가 통째로 자리를 옮긴다
 *  · 위·왼쪽 가장자리 띠: 누르면 그 열·행이 선택된다
 *  · 경계마다 ⊕: 그 자리에 열·행을 넣는다
 *  · 오른쪽 아래 모서리: 끌면 표 전체 너비가 바뀐다
 *
 * 모두 표 **바깥**에 놓여 칸을 가리지 않는다 (예전 단추 막대는 칸을 덮었다).
 */
export function TableHandles({ editor }: TableHandlesProps) {
  const [layout, setLayout] = useState<Layout | null>(null)
  const dragRef = useRef<{ kind: 'size' | 'move'; startX: number; startY: number; startWidth: number; hostWidth: number; moved: boolean } | null>(null)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed || !editor.isActive('table')) { setLayout(null); return }
    // 커서가 든 표를 DOM 에서 찾는다
    let table: HTMLTableElement | null
    try {
      const at = editor.view.domAtPos(editor.state.selection.from).node as HTMLElement
      table = (at.nodeType === 1 ? at : at.parentElement)?.closest('table') || null
    } catch { table = null }
    if (!table) { setLayout(null); return }
    const box = table.getBoundingClientRect()
    const host = (table.closest('.tableWrapper') || table.parentElement) as HTMLElement | null
    const hostWidth = host ? host.getBoundingClientRect().width : box.width
    const firstRow = table.querySelector('tr')
    const cols = firstRow
      ? [...firstRow.children].map((cell) => {
          const r = (cell as HTMLElement).getBoundingClientRect()
          return { left: r.left, width: r.width }
        })
      : []
    const rows = [...table.querySelectorAll('tr')].map((tr) => {
      const r = tr.getBoundingClientRect()
      return { top: r.top, height: r.height }
    })
    setLayout({
      table: { left: box.left, top: box.top, width: box.width, height: box.height },
      hostWidth,
      cols,
      rows,
    })
  }, [editor])

  useEffect(() => {
    if (!editor) return
    /* 첫 측정도 프레임을 한 번 넘겨서 한다 — 그리는 도중에 상태를 바꾸면
       React 가 같은 렌더 안에서 다시 그리기를 반복한다 */
    const first = window.requestAnimationFrame(() => measure())
    const onChange = () => measure()
    editor.on('selectionUpdate', onChange)
    editor.on('update', onChange)
    editor.on('transaction', onChange)
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    return () => {
      window.cancelAnimationFrame(first)
      editor.off('selectionUpdate', onChange)
      editor.off('update', onChange)
      editor.off('transaction', onChange)
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
    }
  }, [editor, measure])

  /* 끌기 — 크기 조절과 자리 옮기기 */
  useEffect(() => {
    if (!editor) return
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      // 단추에서 손을 뗀 뒤의 움직임은 끌기가 아니다 (누름이 어딘가에서 끊긴 경우)
      if (e.buttons === 0) { dragRef.current = null; return }
      drag.moved = true
      if (drag.kind !== 'size') return
      const next = ((drag.startWidth + (e.clientX - drag.startX)) / drag.hostWidth) * 100
      setTableWidthPercent(editor, next)
    }
    const onUp = (e: MouseEvent) => {
      const drag = dragRef.current
      dragRef.current = null
      if (!drag || drag.kind !== 'move') return
      /* 실제로 끌었을 때만 옮긴다 — 누르기만 하고 손을 뗀 경우(표 전체 선택)에는
         움직이면 안 된다. 예전에는 누른 뒤 아무 데서나 손을 떼면 표가 따라 움직였다. */
      if (!drag.moved) return
      const dy = e.clientY - drag.startY
      if (Math.abs(dy) < 24) return
      if (moveTable(editor, dy > 0 ? 1 : -1)) flash(dy > 0 ? '표를 아래로 옮겼습니다' : '표를 위로 옮겼습니다')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [editor])

  if (!editor || !layout) return null
  const { table, cols, rows, hostWidth } = layout
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  /* 열·행 명령은 "커서가 있는 행·열" 을 대상으로 하므로, 먼저 그 행·열을 고른다 */
  const withColumn = (index: number, fn: () => void) => { selectTableColumn(editor, index); fn() }
  const withRow = (index: number, fn: () => void) => { selectTableRow(editor, index); fn() }

  return (
    <div className="jan-table-handles" aria-hidden="true">
      {/* 왼쪽 위 이동 손잡이 — 누르면 표 전체 선택, 위아래로 끌면 자리를 옮긴다 */}
      <button
        type="button"
        className="jan-th-move"
        title="표 전체 선택 (위아래로 끌면 표를 옮깁니다)"
        style={{ left: table.left - HANDLE - 3, top: table.top - HANDLE - 3, width: HANDLE, height: HANDLE }}
        onMouseDown={(e) => {
          stop(e)
          dragRef.current = { kind: 'move', startX: e.clientX, startY: e.clientY, startWidth: table.width, hostWidth, moved: false }
          selectWholeTable(editor)
        }}
      >
        <span />
      </button>

      {/* 오른쪽 아래 크기 조절 손잡이 — 끌면 표 전체 너비가 바뀐다 */}
      <button
        type="button"
        className="jan-th-size"
        title="끌어서 표 너비 조절"
        style={{ left: table.left + table.width - 4, top: table.top + table.height - 4 }}
        onMouseDown={(e) => {
          stop(e)
          if (!findTable(editor)) return
          dragRef.current = { kind: 'size', startX: e.clientX, startY: e.clientY, startWidth: table.width, hostWidth, moved: false }
        }}
      />

      {/* 열 띠 + 경계의 ⊕ */}
      {cols.map((c, i) => (
        <button
          key={'c' + i}
          type="button"
          className="jan-th-col"
          title={`${i + 1}번째 열 선택`}
          style={{ left: c.left, top: table.top - 7, width: c.width, height: 5 }}
          onMouseDown={stop}
          onClick={() => selectTableColumn(editor, i)}
        />
      ))}
      {cols.map((c, i) => (
        <button
          key={'ci' + i}
          type="button"
          className="jan-th-add"
          title={i === 0 ? '왼쪽에 열 추가' : '여기에 열 추가'}
          style={{ left: c.left - 7, top: table.top - 20 }}
          onMouseDown={stop}
          onClick={() => withColumn(i, () => editor.chain().focus().addColumnBefore().run())}
        >+</button>
      ))}
      {cols.length > 0 && (
        <button
          type="button"
          className="jan-th-add"
          title="오른쪽에 열 추가"
          style={{ left: table.left + table.width - 7, top: table.top - 20 }}
          onMouseDown={stop}
          onClick={() => withColumn(cols.length - 1, () => editor.chain().focus().addColumnAfter().run())}
        >+</button>
      )}

      {/* 행 띠 + 경계의 ⊕ */}
      {rows.map((r, i) => (
        <button
          key={'r' + i}
          type="button"
          className="jan-th-row"
          title={`${i + 1}번째 행 선택`}
          style={{ left: table.left - 7, top: r.top, width: 5, height: r.height }}
          onMouseDown={stop}
          onClick={() => selectTableRow(editor, i)}
        />
      ))}
      {rows.map((r, i) => (
        <button
          key={'ri' + i}
          type="button"
          className="jan-th-add"
          title={i === 0 ? '위에 행 추가' : '여기에 행 추가'}
          style={{ left: table.left - 20, top: r.top - 7 }}
          onMouseDown={stop}
          onClick={() => withRow(i, () => editor.chain().focus().addRowBefore().run())}
        >+</button>
      ))}
      {rows.length > 0 && (
        <button
          type="button"
          className="jan-th-add"
          title="아래에 행 추가"
          style={{ left: table.left - 20, top: table.top + table.height - 7 }}
          onMouseDown={stop}
          onClick={() => withRow(rows.length - 1, () => editor.chain().focus().addRowAfter().run())}
        >+</button>
      )}
    </div>
  )
}
