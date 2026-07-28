import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface TableHandlesProps {
  editor: Editor | null
}

interface Rect { left: number; top: number; width: number; height: number }

interface Layout {
  table: Rect
  /** 각 열의 가로 구간 (화면 좌표) */
  cols: Array<{ left: number; width: number }>
  /** 각 행의 세로 구간 */
  rows: Array<{ top: number; height: number }>
}

const HANDLE = 14

/**
 * 표 손잡이 — 워드의 표 조작 방식.
 *
 * 예전에는 표 위에 단추 막대가 떠서 칸을 가렸다. 워드는 그러지 않는다:
 *  · 왼쪽 위 ⊞ 이동 손잡이 (누르면 표 전체 선택)
 *  · 위·왼쪽 가장자리의 가느다란 띠 (누르면 열·행 선택)
 *  · 경계마다 ⊕ (누르면 그 자리에 열·행 삽입)
 * 모두 표 **바깥**에 놓여 칸을 가리지 않는다.
 */
export function TableHandles({ editor }: TableHandlesProps) {
  const [layout, setLayout] = useState<Layout | null>(null)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) { setLayout(null); return }
    if (!editor.isActive('table')) { setLayout(null); return }
    const dom = editor.view.dom.querySelector('table:has(.selectedCell), .ProseMirror-focused table') as HTMLTableElement | null
    // 커서가 든 표를 DOM 에서 찾는다 (선택 표시가 없으면 커서 위치로)
    let table = dom
    if (!table) {
      try {
        const at = editor.view.domAtPos(editor.state.selection.from).node as HTMLElement
        table = (at.nodeType === 1 ? at : at.parentElement)?.closest('table') || null
      } catch { table = null }
    }
    if (!table) { setLayout(null); return }
    const box = table.getBoundingClientRect()
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
    setLayout({ table: { left: box.left, top: box.top, width: box.width, height: box.height }, cols, rows })
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

  if (!editor || !layout) return null
  const { table, cols, rows } = layout
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation() }

  /* 열·행을 고른다 — 그 자리 첫 칸으로 커서를 옮긴다.
     (prosemirror-tables 의 셀 선택은 명령으로 노출돼 있지 않아, 커서 이동으로 대신한다 —
      이어지는 행·열 명령은 모두 "커서가 있는 행·열" 을 대상으로 하므로 결과는 같다) */
  const placeCaret = (cell: HTMLElement) => {
    try {
      const pos = editor.view.posAtDOM(cell, 0)
      editor.commands.focus(pos)
    } catch { /* 못 옮기면 지금 자리를 쓴다 */ }
  }
  const tableEl = () => (editor.view.dom.querySelector('table') as HTMLTableElement | null)
  const selectColumn = (index: number) => {
    const cell = tableEl()?.querySelector('tr')?.children[index] as HTMLElement | undefined
    if (cell) placeCaret(cell)
  }
  const selectRow = (index: number) => {
    const row = tableEl()?.querySelectorAll('tr')[index] as HTMLElement | undefined
    if (row?.firstElementChild) placeCaret(row.firstElementChild as HTMLElement)
  }

  return (
    <div className="jan-table-handles" aria-hidden="true">
      {/* 왼쪽 위 이동 손잡이 — 누르면 표 전체 선택 */}
      <button
        type="button"
        className="jan-th-move"
        title="표 전체 선택"
        style={{ left: table.left - HANDLE - 3, top: table.top - HANDLE - 3, width: HANDLE, height: HANDLE }}
        onMouseDown={stop}
        onClick={() => editor.chain().focus().selectAll().run()}
      >
        <span />
      </button>

      {/* 열 띠 + 경계의 ⊕ */}
      {cols.map((c, i) => (
        <button
          key={'c' + i}
          type="button"
          className="jan-th-col"
          title={`${i + 1}번째 열 선택`}
          style={{ left: c.left, top: table.top - 7, width: c.width, height: 5 }}
          onMouseDown={stop}
          onClick={() => selectColumn(i)}
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
          onClick={() => { selectColumn(i); editor.chain().focus().addColumnBefore().run() }}
        >+</button>
      ))}
      {cols.length > 0 && (
        <button
          type="button"
          className="jan-th-add"
          title="오른쪽에 열 추가"
          style={{ left: table.left + table.width - 7, top: table.top - 20 }}
          onMouseDown={stop}
          onClick={() => { selectColumn(cols.length - 1); editor.chain().focus().addColumnAfter().run() }}
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
          onClick={() => selectRow(i)}
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
          onClick={() => { selectRow(i); editor.chain().focus().addRowBefore().run() }}
        >+</button>
      ))}
      {rows.length > 0 && (
        <button
          type="button"
          className="jan-th-add"
          title="아래에 행 추가"
          style={{ left: table.left - 20, top: table.top + table.height - 7 }}
          onMouseDown={stop}
          onClick={() => { selectRow(rows.length - 1); editor.chain().focus().addRowAfter().run() }}
        >+</button>
      )}
    </div>
  )
}
