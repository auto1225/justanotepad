import type { Editor } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { flash } from './flash'
import { cellNumber, formatNumber } from './tableFormula'

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
export type TableOption =
  | 'data-header-row' | 'data-last-row' | 'data-banded-rows'
  | 'data-first-col' | 'data-last-col' | 'data-banded-cols'

export function toggleTableOption(editor: Editor, name: TableOption): boolean {
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

/* ── 고른 칸의 크기를 키보드로 늘이고 줄이기 ──
   워드에는 정해진 단축키가 없지만, 마우스 없이 표를 다루려면 반드시 있어야 한다.
   고른 열·행이 있으면 그것만, 없으면 커서가 있는 열·행을 대상으로 한다. */

/** 지금 대상이 되는 열 번호들 (선택 → 그 열들, 없으면 커서의 열) */
function targetCols(editor: Editor, cells: CellPick[]): number[] {
  const picked = selectedRowsCols(editor, cells)
  if (picked?.cols.length) return picked.cols
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if (/^table(Cell|Header)$/.test($from.node(d).type.name)) {
      const pos = $from.before(d)
      const cell = cells.find((c) => c.pos === pos)
      if (cell) return [cell.col]
    }
  }
  return []
}

/** 지금 대상이 되는 행 번호들 */
function targetRows(editor: Editor, cells: CellPick[]): number[] {
  const picked = selectedRowsCols(editor, cells)
  if (picked?.rows.length) return picked.rows
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'tableRow') return [$from.index(d - 1)]
  }
  return []
}

/** 고른 열의 너비를 delta 픽셀만큼 (음수면 줄인다) */
export function resizeColumns(editor: Editor, delta: number): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const target = targetCols(editor, cells)
  if (!target.length) return false

  // 지금 너비를 화면에서 읽어 기준으로 삼는다 (지정이 없던 열도 다룰 수 있게)
  const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
  const colEls = dom ? [...dom.querySelectorAll('colgroup col')] as HTMLElement[] : []
  const measured = (col: number) =>
    parseFloat(colEls[col]?.style.width || '') ||
    (dom?.querySelectorAll('tr')[0]?.children[col] as HTMLElement | undefined)?.getBoundingClientRect().width ||
    80

  let tr = editor.state.tr
  for (const cell of cells) {
    const span = Number(cell.node.attrs.colspan) || 1
    const covered = Array.from({ length: span }, (_, i) => cell.col + i)
    if (!covered.some((c) => target.includes(c))) continue
    const current = (cell.node.attrs.colwidth as number[] | null) ?? covered.map((c) => Math.round(measured(c)))
    const next = current.map((w, i) => (target.includes(covered[i]) ? Math.max(24, Math.round(w + delta)) : w))
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: next })
  }
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  flash(`${target.length}개 열 너비 ${delta > 0 ? '+' : ''}${delta}px`)
  return true
}

/** 고른 행의 높이를 delta 픽셀만큼 (음수면 줄인다) */
export function resizeRows(editor: Editor, delta: number): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const target = targetRows(editor, cells)
  if (!target.length) return false

  const dom = editor.view.nodeDOM(table.pos) as HTMLElement | null
  const rowEls = dom ? [...dom.querySelectorAll('tr')] : []

  let tr = editor.state.tr
  let offset = 0
  let index = 0
  table.node.forEach((row) => {
    if (row.type.name === 'tableRow') {
      if (target.includes(index)) {
        const current = parseFloat(String(row.attrs['data-height'] || '')) || rowEls[index]?.getBoundingClientRect().height || 29
        const next = Math.max(18, Math.round(current + delta))
        tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-height': `${next}px` })
      }
      index++
    }
    offset += row.nodeSize
  })
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  flash(`${target.length}개 행 높이 ${delta > 0 ? '+' : ''}${delta}px`)
  return true
}

/* ── 텍스트 배치 (워드) · 글자처럼 취급 (한글) ──
   한글의 「글자처럼 취급」은 표를 한 글자처럼 문장 안에 넣는 것이고,
   워드의 「텍스트 배치」는 표 옆으로 글이 흐르게 하는 것이다. 둘 다 담는다. */

export type TableWrap = 'inline' | 'left' | 'right' | null

export function setTableWrap(editor: Editor, wrap: TableWrap): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, 'data-wrap': wrap })
  )
  flash(
    wrap === 'inline' ? '표를 글자처럼 다룹니다 (문장 안에 들어갑니다)'
      : wrap === 'left' ? '표를 왼쪽에 두고 글이 오른쪽으로 흐릅니다'
      : wrap === 'right' ? '표를 오른쪽에 두고 글이 왼쪽으로 흐릅니다'
      : '표를 문단 사이에 둡니다 (글이 감싸지 않음)'
  )
  return true
}

/** 표를 잘라내거나 복사한다 (표 전체가 한 덩어리로) */
export function copyTable(editor: Editor, cut: boolean): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const dom = editor.view.nodeDOM(table.pos)
  const el = dom instanceof HTMLElement ? (dom.querySelector('table') || dom) : null
  if (!el) return false

  const html = el.outerHTML
  const text = [...el.querySelectorAll('tr')]
    .map((row) => [...row.children].map((c) => (c.textContent || '').trim()).join('\t'))
    .join('\n')

  const write = async () => {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
    } catch {
      // 권한이 없으면 글자만이라도 담는다
      try { await navigator.clipboard.writeText(text) } catch { /* 그래도 안 되면 포기 */ }
    }
    if (cut) {
      const fresh = currentTable(editor)
      if (fresh) editor.view.dispatch(editor.state.tr.delete(fresh.pos, fresh.pos + fresh.node.nodeSize))
    }
    flash(cut ? '표를 잘라냈습니다' : '표를 복사했습니다')
  }
  void write()
  return true
}

/** 셀 대각선 — 한글의 「셀 테두리 ▸ 대각선」 (워드에는 없다) */
export function setCellDiagonal(editor: Editor, kind: 'down' | 'up' | 'both' | null): boolean {
  if (!editor.isActive('table')) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const type = editor.isActive('tableHeader') ? 'tableHeader' : 'tableCell'
  editor.chain().focus().updateAttributes(type, { 'data-diag': kind }).run()
  flash(kind ? '셀에 대각선을 넣었습니다' : '셀 대각선을 지웠습니다')
  return true
}

/** 고른 칸의 합계·평균을 바로 알려 준다 — 한글의 「블록 계산식」 */
export function blockCalc(editor: Editor, kind: 'sum' | 'avg' | 'count'): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const inside = picked
    ? cells.filter((c) => picked.rows.includes(c.row) && picked.cols.includes(c.col))
    : cells
  const numbers = inside
    .map((c) => cellNumber(c.node.textContent))
    .filter((v): v is number => v !== null)
  if (!numbers.length) { flash('고른 칸에 숫자가 없습니다'); return false }
  const sum = numbers.reduce((a, b) => a + b, 0)
  const value = kind === 'sum' ? sum : kind === 'avg' ? sum / numbers.length : numbers.length
  const label = kind === 'sum' ? '합계' : kind === 'avg' ? '평균' : '개수'
  flash(`${label} ${formatNumber(value, '#,##0.##')} (숫자 ${numbers.length}칸)`, 4000)
  return true
}

/**
 * 셀만 지우고 남은 칸을 밀어 넣는다 — 워드의 「셀 삭제…」.
 * 왼쪽으로 밀기: 오른쪽 칸들이 당겨 온다. 위로 밀기: 아래 칸들이 올라온다.
 * (표 구조가 어긋나지 않도록, 밀고 남는 자리는 빈 칸으로 채운다)
 */
export function deleteCellsShift(editor: Editor, direction: 'left' | 'up'): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const rows = Math.max(...cells.map((c) => c.row)) + 1
  const cols = Math.max(...cells.map((c) => c.col)) + 1

  const targetRows = picked?.rows.length ? picked.rows : [cells.find((c) => c.pos === caretCell(editor))?.row ?? 0]
  const targetCols = picked?.cols.length ? picked.cols : [cells.find((c) => c.pos === caretCell(editor))?.col ?? 0]

  /* 글만 옮긴다 — 칸 자체를 없애면 표가 어긋나므로, 워드가 보여 주는 결과
     (뒤 칸이 당겨 오고 마지막 자리는 빈 칸)를 글을 밀어 만든다. */
  const textAt = new Map<string, PMNode | null>()
  for (const cell of cells) textAt.set(`${cell.row},${cell.col}`, cell.node)

  let tr = editor.state.tr
  const empty = editor.schema.nodes.paragraph.createAndFill()
  if (!empty) return false

  const moveInto = (from: { row: number; col: number } | null, to: { row: number; col: number }) => {
    const target = cells.find((c) => c.row === to.row && c.col === to.col)
    if (!target) return
    const source = from ? textAt.get(`${from.row},${from.col}`) : null
    const content = source ? source.content : Fragment.from(empty)
    tr = tr.replaceWith(tr.mapping.map(target.pos + 1), tr.mapping.map(target.pos + target.node.nodeSize - 1), content)
  }

  if (direction === 'left') {
    for (const row of targetRows) {
      const gone = targetCols.length
      for (let col = Math.min(...targetCols); col < cols; col += 1) {
        const src = col + gone < cols ? { row, col: col + gone } : null
        moveInto(src, { row, col })
      }
    }
  } else {
    for (const col of targetCols) {
      const gone = targetRows.length
      for (let row = Math.min(...targetRows); row < rows; row += 1) {
        const src = row + gone < rows ? { row: row + gone, col } : null
        moveInto(src, { row, col })
      }
    }
  }

  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  flash(direction === 'left' ? '칸을 지우고 오른쪽 칸을 당겨 왔다' : '칸을 지우고 아래 칸을 올렸다')
  return true
}

/** 커서가 든 칸의 문서 위치 */
function caretCell(editor: Editor): number {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if (/^table(Cell|Header)$/.test($from.node(d).type.name)) return $from.before(d)
  }
  return -1
}
