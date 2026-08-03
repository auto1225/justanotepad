import type { Editor } from '@tiptap/react'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'
import { flash } from './flash'
import { cellNumber, formatNumber } from './tableFormula'
import { cellRect, cellSelectionSize, keepCellSelection } from './tableSelect'

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

/**
 * 앞 표와 합치기 — 워드에는 단추가 없고 사이의 빈 문단을 지워서 한다.
 * 「표 분할」 로 갈라 놓은 것을 되돌릴 길이 없어 사람이 손으로 지워야 했다.
 * 열 수가 달라도 합친다 (워드가 그렇듯 모자란 칸은 그대로 둔다).
 */
export function mergeWithPreviousTable(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const { state } = editor
  const $pos = state.doc.resolve(table.pos)
  const parent = $pos.parent
  const index = $pos.index()

  /* 바로 앞이 표면 그것과, 사이에 빈 문단 하나뿐이면 그 문단을 지우고 그 앞 표와 합친다 */
  let prevIndex = index - 1
  let 빈문단 = false
  if (prevIndex >= 0 && parent.child(prevIndex).type.name === 'paragraph' && parent.child(prevIndex).content.size === 0) {
    빈문단 = true
    prevIndex -= 1
  }
  if (prevIndex < 0 || parent.child(prevIndex).type.name !== 'table') {
    flash('바로 앞에 표가 없습니다')
    return false
  }

  const prev = parent.child(prevIndex)
  let prevPos = table.pos
  for (let i = index - 1; i >= prevIndex; i--) prevPos -= parent.child(i).nodeSize

  const rows: PMNode[] = []
  prev.forEach((row) => rows.push(row))
  table.node.forEach((row) => rows.push(row))
  editor.view.dispatch(
    state.tr.replaceWith(prevPos, table.pos + table.node.nodeSize, prev.type.create(prev.attrs, rows))
  )
  flash(빈문단 ? '앞 표와 합쳤습니다 (사이의 빈 줄도 지웠습니다)' : '앞 표와 합쳤습니다')
  return true
}

/**
 * 행 나눔 허용/금지 — 워드의 「행이 페이지를 넘어갈 때 나눔 허용」.
 *
 * 우리 조판은 행 경계에서만 나누므로, 금지가 뜻하는 것은
 * 「이 행 안에 든 표를 파고들어 쪼개지 마라」 다 (그래야 그 행이 통째로 다음 쪽으로 간다).
 * 문서에는 data-keep 으로 적히고, 붙여 넣은 break-inside: avoid 와 같은 자리를 쓴다.
 */
export function setRowsKeepWhole(editor: Editor, keep: boolean): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const target = targetRows(editor, pickCells(table.node, table.pos))
  if (!target.length) return false
  return keepCellSelection(editor, () => {
    let tr = editor.state.tr
    let offset = 0
    let index = 0
    table.node.forEach((row) => {
      if (row.type.name === 'tableRow') {
        if (target.includes(index)) {
          tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-keep': keep ? '1' : null })
        }
        index++
      }
      offset += row.nodeSize
    })
    if (!tr.docChanged) return false
    editor.view.dispatch(tr)
    flash(keep ? `${target.length}개 행을 쪽 경계에서 나누지 않습니다` : `${target.length}개 행의 나눔을 허용합니다`)
    return true
  })
}

/**
 * 쪽을 넘느라 나뉜 조각을 도로 한 표로 — 「나누지 마라」 로 마음을 바꿨을 때.
 *
 * 조각들은 서로 다른 쪽(page node)에 들어앉아 형제가 아니다. 그래서 앞 조각에만 표시를
 * 달아 봐야 뒤 조각은 영영 딴 표로 남는다 — 「표를 나누지 않기」 를 눌러도 아무 일이
 * 없어 보였다. 조각이 걸친 자리를 통째로 합친 표 하나로 갈아 끼운다 (쪽은 조판이 다시 나눈다).
 * 나뉜 「행」(data-row-cont)까지 있는 깊은 나눔은 건드리지 않는다 — 드물고, 잘못 붙이면 글을 잃는다.
 */
function 조각모으기(editor: Editor, tablePos: number, 덧붙일: Record<string, string | null> = {}): boolean {
  const { doc } = editor.state
  const 조각: { pos: number; node: PMNode }[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    조각.push({ pos, node })
    return false // 칸 속 표는 남의 것이다
  })
  const 처음 = 조각.findIndex((t) => t.pos === tablePos)
  if (처음 < 0) return false

  const 무리 = [조각[처음]]
  for (let i = 처음 + 1; i < 조각.length && 조각[i].node.attrs['data-cont']; i++) 무리.push(조각[i])
  if (무리.length < 2) return false

  const rows: PMNode[] = []
  let 깊은나눔 = false
  무리.forEach(({ node }, i) => {
    node.forEach((row) => {
      if (row.attrs['data-row-cont']) 깊은나눔 = true
      if (i > 0 && row.attrs['data-repeated']) return // 복제해 얹은 제목 행은 버린다
      rows.push(row)
    })
  })
  if (깊은나눔) return false

  const 끝 = 무리[무리.length - 1]
  /* 합치기와 표시 달기를 **한 트랜잭션**으로 한다. 따로 하면 갈아 끼운 뒤 커서가 표 밖으로
     밀려나 「지금 든 표」 를 못 찾고, 표시가 달리지 않아 조판이 그대로 다시 나눠 버린다
     (실측: 눌러도 조각 [11,13] 그대로, data-keep 은 끝내 null). */
  const 합친표 = 무리[0].node.type.create(
    { ...무리[0].node.attrs, 'data-cont': null, 'data-cont-next': null, ...덧붙일 },
    rows
  )
  try {
    editor.view.dispatch(editor.state.tr.replaceWith(tablePos, 끝.pos + 끝.node.nodeSize, 합친표))
    return true
  } catch {
    return false // 갈아 끼울 수 없으면 그냥 둔다 (표시만 달아도 다음 조판부터는 지켜진다)
  }
}

/** 표 전체를 쪽 경계에서 나눌지 — 「쪼개지 말라」 (한글의 「표를 나누지 않음」) */
export function setTableKeepWhole(editor: Editor, keep: boolean): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const 알림 = () => flash(keep ? '표를 쪽 경계에서 나누지 않습니다 (통째로 넘어갑니다)' : '표를 쪽 경계에서 나눕니다')
  // 이미 나뉘어 있으면 도로 한 표로 모으면서 표시를 단다
  if (keep && 조각모으기(editor, table.pos, { 'data-keep': '1' })) { 알림(); return true }
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(table.pos, undefined, { ...table.node.attrs, 'data-keep': keep ? '1' : null })
  )
  알림()
  return true
}

/**
 * 행 높이 지정 — 워드의 「행 높이」 (빈 값이면 자동).
 *
 * 워드·한글은 고른 칸이 걸친 **행 전부**에 건다. 예전에는 커서가 든 행 하나만 고쳤다 —
 * 세 행을 골라 60px 을 넣어도 한 행만 60px 이 되고 나머지는 그대로였다(실측).
 */
export function setRowHeight(editor: Editor, height: string | null): boolean {
  const table = currentTable(editor)
  if (!table) return false
  const rows = targetRows(editor, pickCells(table.node, table.pos))
  if (!rows.length) return false
  return keepCellSelection(editor, () => {
    let tr = editor.state.tr
    let offset = 0
    let index = 0
    table.node.forEach((row) => {
      if (row.type.name === 'tableRow') {
        if (rows.includes(index)) {
          tr = tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...row.attrs, 'data-height': height })
        }
        index++
      }
      offset += row.nodeSize
    })
    if (!tr.docChanged) return false
    editor.view.dispatch(tr)
    return true
  })
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

/**
 * 지금 고른 칸들의 행·열 번호 (고른 것이 없으면 null).
 *
 * 칸 선택은 창·리본을 거치는 사이에 글자 선택으로 되돌아가기도 한다 —
 * 그때는 tableSelect 가 행·열 번호로 적어 둔 기억(cellRect)을 쓴다.
 * 그러지 않으면 창을 닫고 단추를 누르는 순간 「한 칸만」 바뀐다.
 */
function selectedRowsCols(editor: Editor, cells: CellPick[]): { rows: number[]; cols: number[] } | null {
  const sel = editor.state.selection as unknown as { $anchorCell?: { pos: number }; $headCell?: { pos: number } }
  let top: number, bottom: number, left: number, right: number
  if (sel.$anchorCell && sel.$headCell) {
    const from = Math.min(sel.$anchorCell.pos, sel.$headCell.pos)
    const to = Math.max(sel.$anchorCell.pos, sel.$headCell.pos)
    const anchor = cells.find((c) => c.pos === from)
    const head = cells.find((c) => c.pos === to)
    if (!anchor || !head) return null
    top = Math.min(anchor.row, head.row); bottom = Math.max(anchor.row, head.row)
    left = Math.min(anchor.col, head.col); right = Math.max(anchor.col, head.col)
  } else {
    // 기억해 둔 네모가 아직 살아 있을 때만 (없으면 「고른 것 없음」)
    if (!cellSelectionSize(editor)) return null
    const rect = cellRect(editor)
    if (!rect) return null
    top = rect.top; bottom = rect.bottom; left = rect.left; right = rect.right
  }
  const inside = cells.filter((c) => c.row >= top && c.row <= bottom && c.col >= left && c.col <= right)
  if (!inside.length) return null
  return {
    rows: [...new Set(inside.map((c) => c.row))].sort((a, b) => a - b),
    cols: [...new Set(inside.map((c) => c.col))].sort((a, b) => a - b),
  }
}

/**
 * 이 표 자신의 DOM — 껍데기(.tableWrapper) 안의 첫 표.
 * 칸 속에 든 표(중첩)의 col·tr 까지 걷어 오면 열·행 번호가 어긋난다.
 */
function ownDom(editor: Editor, tablePos: number): { table: HTMLElement | null; cols: HTMLElement[]; rows: HTMLElement[] } {
  const dom = editor.view.nodeDOM(tablePos) as HTMLElement | null
  const table = dom ? ((dom.querySelector('table') as HTMLElement | null) || dom) : null
  if (!table) return { table: null, cols: [], rows: [] }
  return {
    table,
    cols: [...table.querySelectorAll('col')].filter((c) => c.closest('table') === table) as HTMLElement[],
    /* 반복 제목 행은 화면에만 있는 위젯이다 — 문서에는 없으므로 걷어 오면 행 번호가 하나씩 밀린다 */
    rows: [...table.querySelectorAll('tr')]
      .filter((r) => r.closest('table') === table && !r.hasAttribute('data-repeated')) as HTMLElement[],
  }
}

/**
 * 지금 화면에 그려진 열 너비 (픽셀).
 *
 * colgroup 의 col.style.width 는 **끌어서 정한 열에만** 붙는다. 지정이 없는 열은 빈 문자열이라
 * parseFloat 이 NaN → 0 으로 셌다. 그 바람에 「열 너비를 같게」 가 폭을 절반으로 잘못 세어,
 * 184px+152px 인 두 열을 고르면 92px·92px 로 쭈그러들었다(실측). 지정이 없으면 그려진 칸을 읽는다.
 */
function measuredWidths(editor: Editor, tablePos: number, colCount: number): number[] {
  const { table, cols, rows } = ownDom(editor, tablePos)
  const firstRow = rows[0]
  const fallback = (table?.getBoundingClientRect().width || 0) / Math.max(1, colCount) || 80
  return Array.from({ length: colCount }, (_, i) =>
    parseFloat(cols[i]?.style.width || '')
    || (firstRow?.children[i] as HTMLElement | undefined)?.getBoundingClientRect().width
    || fallback)
}

/** 고른 열(없으면 전체)의 너비를 고르게 나눈다 */
export function distributeColumns(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const allCols = [...new Set(cells.map((c) => c.col))].sort((a, b) => a - b)
  const target = picked?.cols.length ? picked.cols : allCols
  /* 열의 개수 — 병합(colspan)이 있으면 칸 수와 다르다. 마지막 칸이 덮는 자리까지 센다. */
  const colCount = cells.reduce((n, c) => Math.max(n, c.col + (Number(c.node.attrs.colspan) || 1)), 0)
  const width = measuredWidths(editor, table.pos, colCount)

  // 대상 열들이 지금 차지한 폭을 합쳐 고르게 나눈다 (워드의 「열 너비를 같게」)
  const total = target.reduce((sum, col) => sum + (width[col] || 0), 0)
  const each = Math.max(24, Math.round(total / target.length))

  return keepCellSelection(editor, () => {
    let tr = editor.state.tr
    for (const cell of cells) {
      const span = Number(cell.node.attrs.colspan) || 1
      const covered = Array.from({ length: span }, (_, i) => cell.col + i)
      if (!covered.some((c) => target.includes(c))) continue
      /* 고르지 않은 열은 지금 폭을 그대로 지킨다 — 여기에 each 를 적으면
         고르지도 않은 열이 함께 끌려가 표 전체가 뒤틀린다 */
      const colwidth = covered.map((c) =>
        (target.includes(c) ? each : ((cell.node.attrs.colwidth as number[] | null)?.[c - cell.col] ?? Math.round(width[c] || each))))
      tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth })
    }
    if (tr.docChanged) editor.view.dispatch(tr)
    flash(picked?.cols.length ? `고른 ${target.length}개 열의 너비를 같게 (${each}px)` : '열 너비를 모두 같게')
    return true
  })
}

/** 고른 행(없으면 전체)의 높이를 고르게 나눈다 */
export function distributeRows(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const picked = selectedRowsCols(editor, cells)
  const rowEls = ownDom(editor, table.pos).rows
  const allRows = rowEls.map((_, i) => i)
  const target = picked?.rows.length ? picked.rows : allRows
  if (!target.length) return false

  const total = target.reduce((sum, i) => sum + (rowEls[i]?.getBoundingClientRect().height || 0), 0)
  const each = Math.max(18, Math.round(total / target.length))

  return keepCellSelection(editor, () => {
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
  })
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
  const colCount = cells.reduce((n, c) => Math.max(n, c.col + (Number(c.node.attrs.colspan) || 1)), 0)
  const width = measuredWidths(editor, table.pos, colCount)

  return keepCellSelection(editor, () => {
    let tr = editor.state.tr
    for (const cell of cells) {
      const span = Number(cell.node.attrs.colspan) || 1
      const covered = Array.from({ length: span }, (_, i) => cell.col + i)
      if (!covered.some((c) => target.includes(c))) continue
      const current = (cell.node.attrs.colwidth as number[] | null) ?? covered.map((c) => Math.round(width[c] || 80))
      const next = current.map((w, i) => (target.includes(covered[i]) ? Math.max(24, Math.round(w + delta)) : w))
      tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: next })
    }
    if (!tr.docChanged) return false
    editor.view.dispatch(tr)
    flash(`${target.length}개 열 너비 ${delta > 0 ? '+' : ''}${delta}px`)
    return true
  })
}

/**
 * 고른 열(없으면 커서가 든 열)의 너비를 px 로 못 박는다 — 워드 「표 속성 › 열 › 너비 지정」.
 * null 이면 지정을 지워 내용에 맞게 되돌린다.
 */
export function setColumnWidth(editor: Editor, px: number | null): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const target = targetCols(editor, cells)
  if (!target.length) return false

  const colCount = cells.reduce((n, c) => Math.max(n, c.col + (Number(c.node.attrs.colspan) || 1)), 0)
  const width = measuredWidths(editor, table.pos, colCount)

  return keepCellSelection(editor, () => {
    let tr = editor.state.tr
    for (const cell of cells) {
      const span = Number(cell.node.attrs.colspan) || 1
      const covered = Array.from({ length: span }, (_, i) => cell.col + i)
      if (!covered.some((c) => target.includes(c))) continue
      if (px == null) {
        tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: null })
        continue
      }

      /* 고르지 않은 열은 지금 폭을 그대로 지킨다 — 여기에 px 를 적으면 남의 열까지 끌려간다 */
      const now = (cell.node.attrs.colwidth as number[] | null)
      const next = covered.map((c, i) =>
        (target.includes(c) ? Math.max(24, Math.round(px)) : (now?.[i] ?? Math.round(width[c] || 80))))
      tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: next })
    }
    if (!tr.docChanged) return false
    editor.view.dispatch(tr)
    if (px == null) 남은열너비지우기(editor, table.pos, target)
    flash(px == null ? '열 너비 지정을 지웠습니다' : `${target.length}개 열 너비 ${Math.round(px)}px`)
    return true
  })
}

/**
 * 문서에서 colwidth 를 지워도 화면의 `<col>` 에 붙은 width 는 남는다 — 직접 걷어 낸다.
 *
 * tiptap 의 updateColumns 는 너비가 있으면 `width`, 없으면 `min-width` 를 **setProperty 로만**
 * 얹는다. 지울 때 앞서 얹은 width 를 지우지 않아, 지정을 없앤 뒤에도 열이 그 폭 그대로였다
 * (실측: 260px 로 정했다가 「지정 지우기」 를 눌러도 colwidth 는 null 인데 col.style.width 는
 * 260px, 그려진 열 폭도 260px 그대로. 손대기 전 213px 로 돌아오지 않았다).
 * 다음 그림에서 updateColumns 가 다시 얹지도 않는다 — 원하는 값('')과 이미 같기 때문이다.
 */
function 남은열너비지우기(editor: Editor, tablePos: number, target: number[]) {
  const { cols } = ownDom(editor, tablePos)
  for (const col of target) cols[col]?.style.removeProperty('width')
}

/**
 * 표의 **모든** 열에서 너비 지정을 걷어 낸다 — 워드의 「열 너비 지정 지우기(내용에 맞게)」.
 *
 * 리본에도 같은 이름의 명령이 있었지만 문서의 colwidth 만 null 로 만들고 화면은 그대로였다
 * (실측: Alt+→ 로 253px 로 넓힌 뒤 눌러도 col.style.width 253px · 그려진 폭 253/193/193 —
 * 손대기 전 213/213/213 로 돌아오지 않았다). 위와 같은 뿌리라 같은 자리에서 함께 고친다.
 */
export function clearColumnWidths(editor: Editor): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const colCount = cells.reduce((n, c) => Math.max(n, c.col + (Number(c.node.attrs.colspan) || 1)), 0)
  let tr = editor.state.tr
  for (const cell of cells) {
    if (cell.node.attrs.colwidth == null) continue
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, colwidth: null })
  }
  if (tr.docChanged) editor.view.dispatch(tr)
  남은열너비지우기(editor, table.pos, Array.from({ length: colCount }, (_, i) => i))
  flash('열 너비를 같게 맞췄습니다')
  return true
}

/** 고른 행의 높이를 delta 픽셀만큼 (음수면 줄인다) */
export function resizeRows(editor: Editor, delta: number): boolean {
  const table = currentTable(editor)
  if (!table) { flash('표 안에 커서를 두고 실행하세요'); return false }
  const cells = pickCells(table.node, table.pos)
  const target = targetRows(editor, cells)
  if (!target.length) return false

  const rowEls = ownDom(editor, table.pos).rows

  return keepCellSelection(editor, () => {
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
  })
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
