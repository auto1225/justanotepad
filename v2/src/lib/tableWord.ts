import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { flash } from './flash'

/**
 * 워드의 표 「레이아웃」 탭에 있는데 편집기에는 없던 기능들.
 * (행 추가·삭제·병합처럼 이미 있는 것은 그대로 쓰고, 여기서는 빠진 것만 채운다)
 */

/** 커서가 든 표와 그 위치 */
function currentTable(editor: Editor): { node: PMNode; pos: number; depth: number } | null {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table') return { node, pos: $from.before(d), depth: d }
  }
  return null
}

/** 커서가 든 행의 순번 (0부터), 표 밖이면 -1 */
function currentRowIndex(editor: Editor): number {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'tableRow') continue
    const table = $from.node(d - 1)
    let index = -1
    let i = 0
    table.forEach((row) => {
      if (row === $from.node(d)) index = i
      i++
    })
    return index
  }
  return -1
}

/** 표 나누기 — 커서가 있는 행부터 새 표로 떼어 낸다 (워드의 「표 분할」) */
export function splitTable(editor: Editor): boolean {
  const table = currentTable(editor)
  const rowIndex = currentRowIndex(editor)
  if (!table || rowIndex <= 0) { flash('둘째 줄 이하에 커서를 두고 실행하세요'); return false }

  const rows: PMNode[] = []
  table.node.forEach((row) => rows.push(row))
  const head = rows.slice(0, rowIndex)
  const tail = rows.slice(rowIndex)
  if (!head.length || !tail.length) return false

  const schema = editor.state.schema
  const tableType = schema.nodes.table
  const paragraph = schema.nodes.paragraph.create()
  const tr = editor.state.tr
  tr.replaceWith(
    table.pos,
    table.pos + table.node.nodeSize,
    [
      tableType.create(table.node.attrs, head),
      paragraph,
      tableType.create(table.node.attrs, tail),
    ]
  )
  editor.view.dispatch(tr)
  flash('표를 둘로 나눴습니다')
  return true
}

/** 행 높이 지정 — 워드의 「행 높이」 (빈 값이면 자동) */
export function setRowHeight(editor: Editor, height: string | null): boolean {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const row = $from.node(d)
    if (row.type.name !== 'tableRow') continue
    const pos = $from.before(d)
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...row.attrs, 'data-height': height }))
    return true
  }
  return false
}

/** 행 높이를 같게 — 지정한 높이를 모두 지운다 (내용에 따라 고르게 잡힌다) */
export function evenRowHeights(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) return false
  let tr = editor.state.tr
  let offset = 0
  table.node.forEach((row) => {
    if (row.type.name === 'tableRow' && row.attrs['data-height']) {
      tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-height': null })
    }
    offset += row.nodeSize
  })
  if (tr.docChanged) editor.view.dispatch(tr)
  return true
}

/** 셀 여백 — 워드의 「셀 여백」 (표 전체에 적용) */
export function setCellPadding(editor: Editor, px: number | null): boolean {
  const table = currentTable(editor)
  if (!table) return false
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, {
      ...table.node.attrs,
      'data-cell-pad': px == null ? null : String(px),
    })
  )
  return true
}

/** 표 스타일 — 워드의 「표 스타일」 갤러리 */
export const TABLE_STYLES: ReadonlyArray<{ value: string; label: string; desc: string }> = [
  { value: '', label: '기본 표', desc: '모든 칸에 가는 선' },
  { value: 'grid', label: '표 (굵은 격자)', desc: '테두리를 또렷하게' },
  { value: 'plain', label: '선 없는 표', desc: '테두리 없이 여백으로만' },
  { value: 'lines', label: '가로선만', desc: '학술 논문에서 흔한 모양' },
  { value: 'banded', label: '줄무늬 행', desc: '한 줄 걸러 옅은 바탕' },
  { value: 'accent', label: '강조 머리글', desc: '머리글 행에 짙은 바탕' },
]

export function setTableStyle(editor: Editor, style: string): boolean {
  const table = currentTable(editor)
  if (!table) return false
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, 'data-style': style || null })
  )
  return true
}

/** 표 스타일 옵션 — 첫째 열·마지막 행 강조 (워드의 「표 스타일 옵션」) */
export function toggleTableOption(editor: Editor, name: 'data-first-col' | 'data-last-row'): boolean {
  const table = currentTable(editor)
  if (!table) return false
  const on = table.node.attrs[name] ? null : '1'
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, [name]: on })
  )
  return true
}

/** 표를 글자로 — 워드의 「표를 텍스트로 변환」 */
export function tableToText(editor: Editor, separator: string): boolean {
  const table = currentTable(editor)
  if (!table) return false
  const lines: string[] = []
  table.node.forEach((row) => {
    if (row.type.name !== 'tableRow') return
    const cells: string[] = []
    row.forEach((cell) => cells.push(cell.textContent.trim()))
    lines.push(cells.join(separator))
  })
  const schema = editor.state.schema
  const paragraphs = lines.map((line) =>
    schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined)
  )
  editor.view.dispatch(
    editor.state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, paragraphs)
  )
  flash(`표를 ${lines.length}줄의 글로 바꿨습니다`)
  return true
}

/** 고른 글을 표로 — 워드의 「텍스트를 표로 변환」 */
export function textToTable(editor: Editor, separator: string): boolean {
  const { from, to, empty } = editor.state.selection
  if (empty) { flash('표로 바꿀 글을 먼저 선택하세요'); return false }
  const text = editor.state.doc.textBetween(from, to, '\n')
  const rows = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!rows.length) return false
  const cols = Math.max(...rows.map((r) => r.split(separator).length))
  const schema = editor.state.schema
  const cellType = schema.nodes.tableCell
  const headerType = schema.nodes.tableHeader
  const rowType = schema.nodes.tableRow
  const makeCell = (text: string, header: boolean) => {
    const type = header ? headerType : cellType
    const para = schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined)
    return type.create(null, para)
  }
  const nodes = rows.map((line, rowIndex) => {
    const parts = line.split(separator)
    const cells = Array.from({ length: cols }, (_, i) => makeCell((parts[i] || '').trim(), rowIndex === 0))
    return rowType.create(null, cells)
  })
  editor.view.dispatch(
    editor.state.tr.replaceWith(from, to, schema.nodes.table.create(null, nodes))
  )
  flash(`${rows.length}행 ${cols}열 표로 바꿨습니다`)
  return true
}

/* ── 선택 기준 균등 분배 (워드의 「열 너비를 같게」·「행 높이를 같게」) ──
   워드는 고른 열·행만 고르게 나눈다. 아무것도 고르지 않았으면 표 전체를 대상으로 한다. */

interface CellPick { pos: number; node: PMNode; row: number; col: number }

/** 표의 칸을 행·열 번호와 함께 모은다 */
function pickCells(table: PMNode, tablePos: number): CellPick[] {
  const out: CellPick[] = []
  let rowIndex = 0
  table.forEach((row, rowOffset) => {
    if (row.type.name !== 'tableRow') return
    let colIndex = 0
    row.forEach((cell, cellOffset) => {
      out.push({ pos: tablePos + 1 + rowOffset + 1 + cellOffset, node: cell, row: rowIndex, col: colIndex })
      colIndex += Number(cell.attrs.colspan) || 1
    })
    rowIndex++
  })
  return out
}

/** 지금 고른 칸들의 행·열 번호 (선택이 없으면 null) */
function selectedRowsCols(editor: Editor, cells: CellPick[]): { rows: number[]; cols: number[] } | null {
  const sel = editor.state.selection as unknown as { $anchorCell?: { pos: number }; $headCell?: { pos: number } }
  if (!sel.$anchorCell || !sel.$headCell) return null
  const inside: CellPick[] = []
  const from = Math.min(sel.$anchorCell.pos, sel.$headCell.pos)
  const to = Math.max(sel.$anchorCell.pos, sel.$headCell.pos)
  const anchor = cells.find((c) => c.pos === from)
  const head = cells.find((c) => c.pos === to)
  if (!anchor || !head) return null
  for (const cell of cells) {
    if (cell.row >= Math.min(anchor.row, head.row) && cell.row <= Math.max(anchor.row, head.row)
      && cell.col >= Math.min(anchor.col, head.col) && cell.col <= Math.max(anchor.col, head.col)) inside.push(cell)
  }
  return {
    rows: [...new Set(inside.map((c) => c.row))].sort((a, b) => a - b),
    cols: [...new Set(inside.map((c) => c.col))].sort((a, b) => a - b),
  }
}

/** 고른 열(없으면 전체)의 너비를 고르게 나눈다 */
export function distributeColumns(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
  const cols = dom?.querySelectorAll('colgroup col') ?? []
  const allCols = [...new Set(cells.map((c) => c.col))].sort((a, b) => a - b)
  const target = picked?.cols.length ? picked.cols : allCols

  // 대상 열들이 지금 차지한 폭을 합쳐 고르게 나눈다
  let total = 0
  target.forEach((col) => { total += parseFloat((cols[col] as HTMLElement | undefined)?.style.width || '0') })
  if (!total) {
    const width = dom?.querySelector('table')?.getBoundingClientRect().width || dom?.getBoundingClientRect().width || 0
    total = (width / Math.max(1, allCols.length)) * target.length
  }
  const each = Math.max(24, Math.round(total / target.length))

  let tr = editor.state.tr
  for (const cell of cells) {
    const span = Number(cell.node.attrs.colspan) || 1
    const covered = Array.from({ length: span }, (_, i) => cell.col + i)
    if (!covered.some((c) => target.includes(c))) continue
    const colwidth = covered.map((c) => (target.includes(c) ? each : ((cell.node.attrs.colwidth as number[] | null)?.[c - cell.col] ?? each)))
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth })
  }
  if (tr.docChanged) editor.view.dispatch(tr)
  flash(picked?.cols.length ? `고른 ${target.length}개 열의 너비를 같게` : '열 너비를 모두 같게')
  return true
}

/** 고른 행(없으면 전체)의 높이를 고르게 나눈다 */
export function distributeRows(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
  const rowEls = dom ? [...dom.querySelectorAll('tr')] : []
  const allRows = rowEls.map((_, i) => i)
  const target = picked?.rows.length ? picked.rows : allRows
  if (!target.length) return false

  const total = target.reduce((sum, i) => sum + (rowEls[i]?.getBoundingClientRect().height || 0), 0)
  const each = Math.max(18, Math.round(total / target.length))

  let tr = editor.state.tr
  let offset = 0
  let index = 0
  table.node.forEach((row) => {
    if (row.type.name === 'tableRow') {
      if (target.includes(index)) {
        tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-height': `${each}px` })
      }
      index++
    }
    offset += row.nodeSize
  })
  if (tr.docChanged) editor.view.dispatch(tr)
  flash(picked?.rows.length ? `고른 ${target.length}개 행의 높이를 같게` : '행 높이를 모두 같게')
  return true
}

/** 행을 위·아래로 옮긴다 — 워드의 Shift+Alt+↑/↓ */
export function moveRow(editor: Editor, dir: -1 | 1): boolean {
  const table = currentTable(editor)
  const index = currentRowIndex(editor)
  if (!table || index < 0) return false
  const rows: PMNode[] = []
  table.node.forEach((row) => { if (row.type.name === 'tableRow') rows.push(row) })
  const to = index + dir
  if (to < 0 || to >= rows.length) return false
  const next = [...rows]
  const [moved] = next.splice(index, 1)
  next.splice(to, 0, moved)
  const tr = editor.state.tr.replaceWith(
    table.pos,
    table.pos + table.node.nodeSize,
    table.node.type.create(table.node.attrs, next)
  )
  editor.view.dispatch(tr)
  flash(dir < 0 ? '행을 위로 옮겼습니다' : '행을 아래로 옮겼습니다')
  return true
}
