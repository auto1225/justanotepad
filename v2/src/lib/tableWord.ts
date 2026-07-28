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
