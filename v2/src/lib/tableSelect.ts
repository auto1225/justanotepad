import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CellSelection } from 'prosemirror-tables'

/**
 * 표 선택·이동 — 워드에서 손잡이로 하는 일들.
 *
 * 워드는 표 왼쪽 위 손잡이를 누르면 표 전체가 선택되고, 끌면 표가 통째로 움직인다.
 * 가장자리 띠를 누르면 그 행·열이 선택된다. 편집기의 기본 명령에는 이 선택이 없어
 * prosemirror-tables 의 CellSelection 을 직접 쓴다.
 */

export interface TableAt {
  node: PMNode
  pos: number
  /** 행 → 그 행의 칸들 (문서 위치) */
  cells: number[][]
}

/** 커서가 든 표 (없으면 null) */
export function findTable(editor: Editor): TableAt | null {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table') return { node, pos: $from.before(d), cells: cellPositions(node, $from.before(d)) }
  }
  return null
}

/** 문서에서 위치를 알고 있는 표의 칸 위치들 */
function cellPositions(table: PMNode, tablePos: number): number[][] {
  const rows: number[][] = []
  table.forEach((row, rowOffset) => {
    if (row.type.name !== 'tableRow') return
    const line: number[] = []
    row.forEach((_cell, cellOffset) => {
      line.push(tablePos + 1 + rowOffset + 1 + cellOffset)
    })
    rows.push(line)
  })
  return rows
}

function apply(editor: Editor, selection: CellSelection): boolean {
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  editor.view.focus()
  return true
}

/** 표 전체 선택 — 워드의 이동 손잡이 클릭 */
export function selectWholeTable(editor: Editor): boolean {
  const table = findTable(editor)
  if (!table || !table.cells.length) return false
  const first = table.cells[0][0]
  const lastRow = table.cells[table.cells.length - 1]
  const last = lastRow[lastRow.length - 1]
  const { doc } = editor.state
  return apply(editor, new CellSelection(doc.resolve(first), doc.resolve(last)))
}

/** 행 하나 선택 — 왼쪽 가장자리 띠 클릭 */
export function selectTableRow(editor: Editor, rowIndex: number): boolean {
  const table = findTable(editor)
  const row = table?.cells[rowIndex]
  if (!table || !row?.length) return false
  const { doc } = editor.state
  return apply(editor, CellSelection.rowSelection(doc.resolve(row[0]), doc.resolve(row[row.length - 1])))
}

/** 열 하나 선택 — 위쪽 가장자리 띠 클릭 */
export function selectTableColumn(editor: Editor, colIndex: number): boolean {
  const table = findTable(editor)
  if (!table || !table.cells.length) return false
  const top = table.cells[0][colIndex]
  const bottom = table.cells[table.cells.length - 1][colIndex]
  if (top == null || bottom == null) return false
  const { doc } = editor.state
  return apply(editor, CellSelection.colSelection(doc.resolve(top), doc.resolve(bottom)))
}

/** 표를 앞/뒤 블록과 자리 바꾸기 — 워드에서 손잡이를 끌어 옮기는 것과 같은 결과 */
export function moveTable(editor: Editor, dir: -1 | 1): boolean {
  const table = findTable(editor)
  if (!table) return false
  const { state } = editor
  const $pos = state.doc.resolve(table.pos)
  const parent = $pos.parent
  const index = $pos.index()
  const targetIndex = index + dir
  if (targetIndex < 0 || targetIndex >= parent.childCount) return false

  const sibling = parent.child(targetIndex)
  const tr = state.tr
  const tableEnd = table.pos + table.node.nodeSize
  if (dir === 1) {
    // 표를 뒤 블록 다음으로 — 뒤 블록을 표 앞으로 끌어온다
    tr.delete(tableEnd, tableEnd + sibling.nodeSize)
    tr.insert(table.pos, sibling)
  } else {
    const siblingStart = table.pos - sibling.nodeSize
    tr.delete(siblingStart, table.pos)
    tr.insert(siblingStart + table.node.nodeSize, sibling)
  }
  editor.view.dispatch(tr)
  return true
}

/** 표 전체 너비를 백분율로 — 워드의 오른쪽 아래 크기 조절 손잡이 */
export function setTableWidthPercent(editor: Editor, percent: number): boolean {
  const table = findTable(editor)
  if (!table) return false
  const pct = Math.max(10, Math.min(100, Math.round(percent)))
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, {
      ...table.node.attrs,
      'data-width': pct >= 100 ? null : `${pct}%`,
      'data-fit': pct >= 100 ? null : 'fixed',
    })
  )
  return true
}
