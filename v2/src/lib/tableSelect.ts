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
  /* 이미 편집기에 초점이 있으면 다시 주지 않는다 —
     연달아 초점을 주면 브라우저가 화면 선택을 되돌리면서 칸 선택이 글자 선택으로 바뀐다. */
  if (!editor.view.hasFocus()) editor.view.focus()
  return true
}

/** 표 전체 선택 — 워드의 이동 손잡이 클릭 */
export function selectWholeTable(editor: Editor): boolean {
  const table = findTable(editor)
  if (!table || !table.cells.length) return false
  const lastRow = table.cells[table.cells.length - 1]
  return selectCellRect(editor, { top: 0, left: 0, bottom: table.cells.length - 1, right: lastRow.length - 1 })
}

/** 행 하나 선택 — 왼쪽 가장자리 띠 클릭 */
export function selectTableRow(editor: Editor, rowIndex: number): boolean {
  const table = findTable(editor)
  const row = table?.cells[rowIndex]
  if (!table || !row?.length) return false
  return selectCellRect(editor, { top: rowIndex, left: 0, bottom: rowIndex, right: row.length - 1 })
}

/** 열 하나 선택 — 위쪽 가장자리 띠 클릭 */
export function selectTableColumn(editor: Editor, colIndex: number): boolean {
  const table = findTable(editor)
  if (!table || !table.cells.length) return false
  if (table.cells[0][colIndex] == null) return false
  return selectCellRect(editor, { top: 0, left: colIndex, bottom: table.cells.length - 1, right: colIndex })
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

/**
 * 표 전체 너비를 백분율로 — 워드의 오른쪽 아래 크기 조절 손잡이.
 *
 * 열 너비 조절 플러그인이 칸마다 픽셀 너비(colwidth)를 적어 두면 그 합이 표 폭을 붙든다 —
 * 백분율만 바꿔서는 화면이 꿈쩍도 하지 않는다. 워드처럼 열 너비도 같은 비율로 줄이고 늘린다.
 */
export function setTableWidthPercent(editor: Editor, percent: number, hostWidth?: number): boolean {
  const table = findTable(editor)
  if (!table) return false
  const pct = Math.max(10, Math.min(100, Math.round(percent)))
  let tr = editor.state.tr.setNodeMarkup(table.pos, undefined, {
    ...table.node.attrs,
    'data-width': pct >= 100 ? null : `${pct}%`,
    'data-fit': pct >= 100 ? null : 'fixed',
  })

  // 지정된 열 너비가 있으면 목표 폭에 맞춰 함께 조정한다
  const widths: number[] = []
  table.node.forEach((row) => {
    if (row.type.name !== 'tableRow' || widths.length) return
    row.forEach((cell) => {
      const colwidth = cell.attrs.colwidth as number[] | null
      if (colwidth) widths.push(...colwidth)
    })
  })
  const current = widths.reduce((a, b) => a + b, 0)
  if (current > 0 && hostWidth) {
    const ratio = (hostWidth * pct) / 100 / current
    if (Math.abs(ratio - 1) > 0.01) {
      let offset = 0
      table.node.forEach((row) => {
        if (row.type.name === 'tableRow') {
          let cellOffset = 0
          row.forEach((cell) => {
            const colwidth = cell.attrs.colwidth as number[] | null
            if (colwidth) {
              const next = colwidth.map((w) => Math.max(24, Math.round(w * ratio)))
              tr = tr.setNodeMarkup(table.pos + 1 + offset + 1 + cellOffset, undefined, { ...cell.attrs, colwidth: next })
            }
            cellOffset += cell.nodeSize
          })
        }
        offset += row.nodeSize
      })
    }
  }
  editor.view.dispatch(tr)
  return true
}

/**
 * 행 하나의 높이를 정한다 — **자리로**. (손잡이를 끌 때 쓴다)
 *
 * 순번으로 다루면 끄는 사이에 표가 쪽 경계에서 갈리는 순간 죽는다. 끌던 행이 뒤 조각으로
 * 넘어가면 앞 조각에는 그 순번의 행이 없어 아무 일도 일어나지 않는다 —
 * 실측: 여섯째 행을 끌다 조각이 [5,1,1,1] 로 갈린 걸음에서 높이가 420px 에 멎었다.
 * 자리는 문서가 바뀔 때마다 함께 옮겨 주면 조각을 넘어가도 같은 행을 가리킨다.
 */
export function setRowHeightAtPos(editor: Editor, pos: number, height: string | null): boolean {
  if (pos < 0 || pos >= editor.state.doc.content.size) return false
  const row = editor.state.doc.nodeAt(pos)
  if (!row || row.type.name !== 'tableRow') return false
  if (row.attrs['data-height'] === height) return true
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...row.attrs, 'data-height': height }))
  return true
}

/** 행 하나의 높이를 정한다 (순번으로 — 표가 갈리지 않는 자리에서만 믿을 수 있다) */
export function setRowHeightAt(editor: Editor, rowIndex: number, height: string | null): boolean {
  const table = findTable(editor)
  if (!table) return false
  let offset = 0
  let index = 0
  let target = -1
  let attrs: Record<string, unknown> = {}
  table.node.forEach((row) => {
    if (row.type.name === 'tableRow') {
      if (index === rowIndex) { target = table.pos + 1 + offset; attrs = { ...row.attrs } }
      index++
    }
    offset += row.nodeSize
  })
  if (target < 0) return false
  editor.view.dispatch(editor.state.tr.setNodeMarkup(target, undefined, { ...attrs, 'data-height': height }))
  return true
}

/**
 * 표 전체 높이를 비율로 늘이고 줄인다 — 워드의 모서리 손잡이를 위아래로 끌 때.
 * 지금 화면에 그려진 행 높이를 기준으로 삼아, 지정이 없던 행에도 값을 준다.
 */
export function scaleRowHeights(editor: Editor, factor: number, baseHeights: number[]): boolean {
  const table = findTable(editor)
  if (!table) return false
  const MIN = 18
  let tr = editor.state.tr
  let offset = 0
  let index = 0
  table.node.forEach((row) => {
    if (row.type.name === 'tableRow') {
      const base = baseHeights[index]
      if (base) {
        const next = Math.max(MIN, Math.round(base * factor))
        tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-height': `${next}px` })
      }
      index++
    }
    offset += row.nodeSize
  })
  if (tr.docChanged) editor.view.dispatch(tr)
  return true
}

/* ── 칸 선택 다루기 — 워드의 「선택」 메뉴와 Shift+방향키 ──────────── */

export interface CellRect { top: number; left: number; bottom: number; right: number }

/** 위치 → 그 칸의 [행, 열] */
function gridIndex(cells: number[][], pos: number): [number, number] | null {
  for (let r = 0; r < cells.length; r += 1) {
    const c = cells[r].indexOf(pos)
    if (c >= 0) return [r, c]
  }
  return null
}

/** 커서가 든 칸의 위치 */
function caretCellPos(editor: Editor): number | null {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if (/^table(Cell|Header)$/.test($from.node(d).type.name)) return $from.before(d)
  }
  return null
}

/**
 * 마지막으로 고른 네모를 기억해 둔다.
 *
 * 칸 선택은 화면(DOM) 선택과 짝을 이루는데, 키를 빠르게 연달아 누르면
 * 브라우저가 화면 선택을 되돌리는 사이에 칸 선택이 글자 선택으로 바뀐다.
 * 그러면 한 번 누를 때마다 선택이 풀린 것처럼 보인다 — 실제로 그렇게 보였다.
 * 그래서 고른 자리를 행·열 번호로 따로 적어 두고, 커서가 그 네모 안에 있으면
 * 아직 그 칸들을 고른 것으로 본다.
 */
interface LastPick { tablePos: number; anchor: [number, number]; head: [number, number]; at: number }
let lastPick: LastPick | null = null

/** 기억이 아직 쓸모 있는지 — 같은 표에서, 커서가 그 네모 안에 있을 때만 */
function recallPick(editor: Editor, table: TableAt): LastPick | null {
  if (!lastPick || lastPick.tablePos !== table.pos) return null
  if (Date.now() - lastPick.at > 15000) return null
  const pos = caretCellPos(editor)
  const at = pos == null ? null : gridIndex(table.cells, pos)
  if (!at) return null
  const top = Math.min(lastPick.anchor[0], lastPick.head[0])
  const bottom = Math.max(lastPick.anchor[0], lastPick.head[0])
  const left = Math.min(lastPick.anchor[1], lastPick.head[1])
  const right = Math.max(lastPick.anchor[1], lastPick.head[1])
  const inside = at[0] >= top && at[0] <= bottom && at[1] >= left && at[1] <= right
  return inside ? lastPick : null
}

/** 지금 고른 칸의 붙잡은 자리와 움직이는 끝 (없으면 커서가 든 칸) */
function anchorHead(editor: Editor): { table: TableAt; anchor: [number, number]; head: [number, number] } | null {
  const table = findTable(editor)
  if (!table?.cells.length) return null
  const sel = editor.state.selection
  if (sel instanceof CellSelection) {
    const anchor = gridIndex(table.cells, sel.$anchorCell.pos)
    const head = gridIndex(table.cells, sel.$headCell.pos)
    if (anchor && head) return { table, anchor, head }
  }
  const recalled = recallPick(editor, table)
  if (recalled) return { table, anchor: recalled.anchor, head: recalled.head }
  const pos = caretCellPos(editor)
  const at = pos == null ? null : gridIndex(table.cells, pos)
  if (!at) return null
  return { table, anchor: at, head: at }
}

/**
 * 지금 고른 칸들이 이루는 네모.
 * 칸을 고르지 않았으면 커서가 든 칸 하나를 네모로 본다 —
 * 워드도 「선택한 칸이 없으면 커서가 든 칸」 에 명령을 건다.
 */
export function cellRect(editor: Editor): CellRect | null {
  const at = anchorHead(editor)
  if (!at) return null
  return {
    top: Math.min(at.anchor[0], at.head[0]), bottom: Math.max(at.anchor[0], at.head[0]),
    left: Math.min(at.anchor[1], at.head[1]), right: Math.max(at.anchor[1], at.head[1]),
  }
}

/** 네모대로 칸을 다시 고른다 */
export function selectCellRect(editor: Editor, rect: CellRect): boolean {
  const table = findTable(editor)
  if (!table?.cells.length) return false
  const rows = table.cells.length
  const top = Math.max(0, Math.min(rows - 1, rect.top))
  const bottom = Math.max(0, Math.min(rows - 1, rect.bottom))
  const cols = table.cells[top].length
  const left = Math.max(0, Math.min(cols - 1, rect.left))
  const right = Math.max(0, Math.min(table.cells[bottom].length - 1, rect.right))
  const from = table.cells[top]?.[left]
  const to = table.cells[bottom]?.[right]
  if (from == null || to == null) return false
  const { doc } = editor.state
  remember(table.pos, [top, left], [bottom, right])
  return apply(editor, new CellSelection(doc.resolve(from), doc.resolve(to)))
}

function remember(tablePos: number, anchor: [number, number], head: [number, number]) {
  lastPick = { tablePos, anchor, head, at: Date.now() }
}

/** 칸 하나 선택 — 워드 「레이아웃 › 선택 › 셀 선택」 */
export function selectCurrentCell(editor: Editor): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  return selectCellRect(editor, { top: rect.top, left: rect.left, bottom: rect.top, right: rect.left })
}

/**
 * 고른 칸을 한 칸씩 넓히고 좁힌다 — 워드의 Shift+방향키.
 * 붙잡은 자리(anchor)는 그대로 두고 반대쪽 끝만 움직인다.
 */
export function extendCellSelection(editor: Editor, dRow: number, dCol: number): boolean {
  const at = anchorHead(editor)
  if (!at) return false
  const { table, anchor, head } = at

  const rows = table.cells.length
  const nextRow = Math.max(0, Math.min(rows - 1, head[0] + dRow))
  const cols = table.cells[nextRow].length
  const nextCol = Math.max(0, Math.min(cols - 1, head[1] + dCol))

  const from = table.cells[anchor[0]]?.[Math.min(anchor[1], table.cells[anchor[0]].length - 1)]
  const to = table.cells[nextRow]?.[nextCol]
  if (from == null || to == null) return false
  const { doc } = editor.state
  remember(table.pos, anchor, [nextRow, nextCol])
  return apply(editor, new CellSelection(doc.resolve(from), doc.resolve(to)))
}

/** 칸 선택을 풀고 커서로 돌아간다 — 워드에서 Esc 를 눌렀을 때 */
export function collapseCellSelection(editor: Editor): boolean {
  const sel = editor.state.selection
  if (!(sel instanceof CellSelection)) return false
  lastPick = null
  editor.chain().focus(sel.$headCell.pos + 2).run()
  return true
}

/** 표를 벗어나거나 새로 누를 때 기억을 버린다 */
export function forgetCellPick(): void {
  lastPick = null
}

/**
 * 명령을 실행하고 고른 칸을 되돌려 놓는다.
 *
 * 크기를 조금씩 고칠 때 한 번 누를 때마다 선택이 풀리면 다시 고르느라 일이 안 된다.
 * 위치 대응(mapping)만 믿으면 문서가 다시 짜이는 순간(쪽 나눔·표 나뉨) 선택이 글자
 * 선택으로 바뀌므로, 행·열 번호로 기억했다가 그대로 다시 고른다.
 */
export function keepCellSelection(editor: Editor, run: () => boolean): boolean {
  const had = editor.state.selection instanceof CellSelection || recallActive(editor)
  const rect = had ? cellRect(editor) : null
  const ok = run()
  if (!ok || !rect) return ok
  // 명령이 끝난 뒤(그리고 재배치가 끝난 뒤) 다시 고른다
  if (!(editor.state.selection instanceof CellSelection)) selectCellRect(editor, rect)
  else {
    const now = cellRect(editor)
    if (!now || now.top !== rect.top || now.left !== rect.left || now.bottom !== rect.bottom || now.right !== rect.right) {
      selectCellRect(editor, rect)
    }
  }
  return ok
}

/** 기억해 둔 칸 선택이 아직 살아 있는지 */
function recallActive(editor: Editor): boolean {
  const table = findTable(editor)
  return !!(table && recallPick(editor, table))
}

/** 고른 칸의 크기 — 「3행 2열」 처럼 알려 줄 때 쓴다 */
export function cellSelectionSize(editor: Editor): { rows: number; cols: number } | null {
  const sel = editor.state.selection
  if (!(sel instanceof CellSelection) && !recallActive(editor)) return null
  const rect = cellRect(editor)
  if (!rect) return null
  return { rows: rect.bottom - rect.top + 1, cols: rect.right - rect.left + 1 }
}
