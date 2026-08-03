import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { cellRect, findTable } from './tableSelect'
import type { CellRect } from './tableSelect'
import { flash } from './flash'

/**
 * 표 테두리와 채우기 — 워드의 「표 디자인 › 테두리 · 음영」.
 *
 * 워드는 「펜 색 · 펜 두께 · 펜 모양」 을 먼저 정해 두고, 어느 변에 그을지를
 * 고른다(모든 테두리 · 바깥쪽 · 안쪽 · 위 · 아래 · 왼쪽 · 오른쪽 · 없음).
 * 그 방식을 그대로 옮겼다 — 정해 둔 펜은 다음에 그릴 때도 그대로 쓰인다.
 */

export interface Pen { color: string; width: number; style: string }

export const BORDER_STYLES: { key: string; label: string }[] = [
  { key: 'solid', label: '실선' },
  { key: 'dashed', label: '파선' },
  { key: 'dotted', label: '점선' },
  { key: 'double', label: '이중선' },
  { key: 'groove', label: '음각' },
  { key: 'ridge', label: '양각' },
]

export const BORDER_WIDTHS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4.5, 6]

/** 워드의 선 두께 — pt 로 적고 픽셀로 그린다 (1pt ≈ 1.333px) */
export const LINE_WIDTHS: { label: string; px: number }[] = [
  { label: '½ pt', px: 0.67 },
  { label: '¾ pt', px: 1 },
  { label: '1 pt', px: 1.33 },
  { label: '1½ pt', px: 2 },
  { label: '2¼ pt', px: 3 },
  { label: '3 pt', px: 4 },
  { label: '4½ pt', px: 6 },
  { label: '6 pt', px: 8 },
]

/** 어느 변에 그을지 — 워드의 「테두리」 드롭다운 */
export type BorderWhere =
  | 'all' | 'outer' | 'inner' | 'inner-h' | 'inner-v'
  | 'top' | 'bottom' | 'left' | 'right' | 'none'

export const BORDER_WHERE: { key: BorderWhere; label: string }[] = [
  { key: 'all', label: '모든 테두리' },
  { key: 'outer', label: '바깥쪽 테두리' },
  { key: 'inner', label: '안쪽 테두리' },
  { key: 'inner-h', label: '안쪽 가로 테두리' },
  { key: 'inner-v', label: '안쪽 세로 테두리' },
  { key: 'top', label: '위쪽 테두리' },
  { key: 'bottom', label: '아래쪽 테두리' },
  { key: 'left', label: '왼쪽 테두리' },
  { key: 'right', label: '오른쪽 테두리' },
  { key: 'none', label: '테두리 없음' },
]

/* ── 지금 쥔 펜 ─────────────────────────────────────── */

const PEN_KEY = 'jan-v2-table-pen'
let pen: Pen = { color: '#333333', width: 1, style: 'solid' }

try {
  const saved = JSON.parse(localStorage.getItem(PEN_KEY) || 'null') as Pen | null
  if (saved?.color) pen = saved
} catch { /* 저장본이 깨졌으면 기본 펜을 쓴다 */ }

export function currentPen(): Pen {
  return { ...pen }
}

export function setPen(next: Partial<Pen>): Pen {
  pen = { ...pen, ...next }
  try { localStorage.setItem(PEN_KEY, JSON.stringify(pen)) } catch { /* 저장 실패는 넘어간다 */ }
  return { ...pen }
}

/** 'width|style|color' 한 줄로 적어 둔다 (저장본에 그대로 실린다) */
export function penToValue(p: Pen): string {
  return `${p.width}|${p.style}|${p.color}`
}

export function valueToCss(value: string | null | undefined): string | null {
  if (!value) return null
  if (value === 'none') return 'none'
  const [w, style, color] = String(value).split('|')
  if (!w) return null
  return `${w}px ${style || 'solid'} ${color || '#333'}`
}

/* ── 그리기 ─────────────────────────────────────────── */

interface CellAt { node: PMNode; pos: number; row: number; col: number }

/** 고른 네모 안의 칸들을 행·열 번호와 함께 */
function cellsInRect(editor: Editor, rect: CellRect): CellAt[] {
  const table = findTable(editor)
  if (!table) return []
  const out: CellAt[] = []
  for (let row = rect.top; row <= rect.bottom && row < table.cells.length; row += 1) {
    for (let col = rect.left; col <= rect.right && col < table.cells[row].length; col += 1) {
      const pos = table.cells[row][col]
      const node = editor.state.doc.nodeAt(pos)
      if (node) out.push({ node, pos, row, col })
    }
  }
  return out
}

/** 이 칸의 어느 변을 건드릴지 */
function sidesFor(where: BorderWhere, cell: CellAt, rect: CellRect): ('top' | 'right' | 'bottom' | 'left')[] {
  const isTop = cell.row === rect.top
  const isBottom = cell.row === rect.bottom
  const isLeft = cell.col === rect.left
  const isRight = cell.col === rect.right
  switch (where) {
    case 'all': return ['top', 'right', 'bottom', 'left']
    case 'none': return ['top', 'right', 'bottom', 'left']
    case 'outer': return [
      ...(isTop ? ['top' as const] : []),
      ...(isBottom ? ['bottom' as const] : []),
      ...(isLeft ? ['left' as const] : []),
      ...(isRight ? ['right' as const] : []),
    ]
    case 'inner': return [
      ...(isBottom ? [] : ['bottom' as const]),
      ...(isRight ? [] : ['right' as const]),
    ]
    case 'inner-h': return isBottom ? [] : ['bottom']
    case 'inner-v': return isRight ? [] : ['right']
    case 'top': return isTop ? ['top'] : []
    case 'bottom': return isBottom ? ['bottom'] : []
    case 'left': return isLeft ? ['left'] : []
    case 'right': return isRight ? ['right'] : []
    default: return []
  }
}

const ATTR: Record<'top' | 'right' | 'bottom' | 'left', string> = {
  top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft',
}

/**
 * 고른 칸(없으면 커서가 든 칸)의 테두리를 긋는다.
 * 워드처럼 「어디에」 만 고르면 되고, 굵기·색·모양은 쥐고 있는 펜을 쓴다.
 */
export function applyBorders(editor: Editor, where: BorderWhere, override?: Partial<Pen>): boolean {
  const rect = cellRect(editor)
  if (!rect) { flash('표 안에 커서를 두고 하세요'); return false }
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  const use = override ? { ...pen, ...override } : pen
  const value = where === 'none' ? 'none' : penToValue(use)

  let tr = editor.state.tr
  for (const cell of cells) {
    const sides = sidesFor(where, cell, rect)
    if (!sides.length) continue
    const attrs: Record<string, unknown> = { ...cell.node.attrs }
    for (const side of sides) attrs[ATTR[side]] = value
    tr = tr.setNodeMarkup(cell.pos, undefined, attrs)
  }
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  const label = BORDER_WHERE.find((w) => w.key === where)?.label || '테두리'
  flash(where === 'none' ? '테두리를 지웠다' : `${label} — ${use.width}px ${BORDER_STYLES.find((s) => s.key === use.style)?.label || use.style}`)
  return true
}

/** 칸 색 채우기 — 워드의 「음영」 */
export function applyShading(editor: Editor, color: string | null): boolean {
  const rect = cellRect(editor)
  if (!rect) { flash('표 안에 커서를 두고 하세요'); return false }
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, backgroundColor: color })
  }
  editor.view.dispatch(tr)
  flash(color ? `칸 ${cells.length}개를 ${color} 로 채웠다` : '채우기를 지웠다')
  return true
}

/** 칸 안쪽 여백 — 워드의 「셀 여백」 (고른 칸에만) */
export function applyCellPadding(editor: Editor, padding: string | null): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, 'data-pad': padding })
  }
  editor.view.dispatch(tr)
  flash(padding ? `칸 여백 ${padding}` : '칸 여백을 기본값으로')
  return true
}

/** 칸 안 글의 가로·세로 맞춤 — 워드의 아홉 칸 「맞춤」 */
export function applyCellAlign(
  editor: Editor,
  horizontal: 'left' | 'center' | 'right' | 'justify',
  vertical: 'top' | 'middle' | 'bottom'
): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false

  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, valign: vertical })
    // 칸 안의 문단마다 가로 맞춤을 준다
    cell.node.descendants((child, offset) => {
      if (!child.isTextblock) return
      const at = cell.pos + 1 + offset
      tr = tr.setNodeMarkup(at, undefined, { ...child.attrs, textAlign: horizontal })
    })
  }
  editor.view.dispatch(tr)
  const hName = { left: '왼쪽', center: '가운데', right: '오른쪽', justify: '양쪽' }[horizontal]
  const vName = { top: '위', middle: '가운데', bottom: '아래' }[vertical]
  flash(`칸 맞춤 — 가로 ${hName} · 세로 ${vName}`)
  return true
}

/** 칸 안 글의 들여쓰기 — 고른 칸의 문단을 함께 민다 */
export function applyCellIndent(editor: Editor, delta: number): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  let touched = 0
  for (const cell of cells) {
    cell.node.descendants((child, offset) => {
      if (!child.isTextblock) return
      const at = cell.pos + 1 + offset
      const now = Number(child.attrs.indent) || 0
      const next = Math.max(0, Math.min(8, now + delta))
      if (next === now) return
      tr = tr.setNodeMarkup(at, undefined, { ...child.attrs, indent: next })
      touched += 1
    })
  }
  if (!touched) return false
  editor.view.dispatch(tr)
  flash(delta > 0 ? '칸 안 글을 들여썼다' : '칸 안 글을 내어썼다')
  return true
}

/** 색 판 — 워드의 테마 색과 같은 결 */
export const CELL_COLORS: { color: string | null; label: string }[] = [
  { color: null, label: '채우기 없음' },
  { color: '#ffffff', label: '흰색' },
  { color: '#f2f4f7', label: '아주 연한 회색' },
  { color: '#e4e7ec', label: '연한 회색' },
  { color: '#98a2b3', label: '회색' },
  { color: '#475467', label: '진한 회색' },
  { color: '#101828', label: '검정' },
  { color: '#fee4e2', label: '연한 빨강' },
  { color: '#f04438', label: '빨강' },
  { color: '#fef0c7', label: '연한 노랑' },
  { color: '#f79009', label: '주황' },
  { color: '#d1fadf', label: '연한 초록' },
  { color: '#12b76a', label: '초록' },
  { color: '#d1e9ff', label: '연한 파랑' },
  { color: '#2e90fa', label: '파랑' },
  { color: '#e9d7fe', label: '연한 보라' },
  { color: '#7a5af8', label: '보라' },
]

/* ── 워드 색판 — 테마 색 · 표준 색 (첨부한 화면과 같은 구성) ────────── */

/** 테마 색 열 머리 (위에서 아래로 밝기 단계가 붙는다) */
export const THEME_COLORS: { label: string; shades: string[] }[] = [
  { label: '흰색', shades: ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#808080'] },
  { label: '검정', shades: ['#000000', '#808080', '#595959', '#404040', '#262626', '#0d0d0d'] },
  { label: '밝은 회색', shades: ['#e7e6e6', '#d0cece', '#aeaaaa', '#757171', '#3b3838', '#181717'] },
  { label: '짙은 청회색', shades: ['#44546a', '#d6dce5', '#adb9ca', '#8496b0', '#333f50', '#222a35'] },
  { label: '파랑', shades: ['#4472c4', '#d9e2f3', '#b4c7e7', '#8faadc', '#2f5597', '#1f3864'] },
  { label: '주황', shades: ['#ed7d31', '#fbe5d6', '#f7caac', '#f4b183', '#c55a11', '#833c0c'] },
  { label: '회색', shades: ['#a5a5a5', '#ededed', '#dbdbdb', '#c9c9c9', '#7b7b7b', '#525252'] },
  { label: '노랑', shades: ['#ffc000', '#fff2cc', '#ffe598', '#ffd965', '#bf9000', '#7f6000'] },
  { label: '하늘', shades: ['#5b9bd5', '#deebf6', '#bdd7ee', '#9cc3e5', '#2e75b5', '#1f4e79'] },
  { label: '초록', shades: ['#70ad47', '#e2efd9', '#c5e0b3', '#a8d08d', '#548235', '#375623'] },
]

/** 표준 색 — 워드의 아래 줄 */
export const STANDARD_COLORS: { color: string; label: string }[] = [
  { color: '#c00000', label: '진한 빨강' },
  { color: '#ff0000', label: '빨강' },
  { color: '#ffc000', label: '주황' },
  { color: '#ffff00', label: '노랑' },
  { color: '#92d050', label: '연두' },
  { color: '#00b050', label: '초록' },
  { color: '#00b0f0', label: '하늘색' },
  { color: '#0070c0', label: '파랑' },
  { color: '#002060', label: '진한 파랑' },
  { color: '#7030a0', label: '보라' },
]

/** 테마 테두리 — 워드의 「테두리 스타일」 갤러리 (펜 한 벌씩) */
export const BORDER_PRESETS: { label: string; pen: Pen }[] = [
  { label: '가는 실선 (검정)', pen: { color: '#000000', width: 0.75, style: 'solid' } },
  { label: '보통 실선 (검정)', pen: { color: '#000000', width: 1.5, style: 'solid' } },
  { label: '굵은 실선 (검정)', pen: { color: '#000000', width: 3, style: 'solid' } },
  { label: '가는 실선 (파랑)', pen: { color: '#4472c4', width: 0.75, style: 'solid' } },
  { label: '보통 실선 (파랑)', pen: { color: '#4472c4', width: 1.5, style: 'solid' } },
  { label: '가는 실선 (주황)', pen: { color: '#ed7d31', width: 0.75, style: 'solid' } },
  { label: '보통 실선 (회색)', pen: { color: '#a5a5a5', width: 1.5, style: 'solid' } },
  { label: '가는 실선 (노랑)', pen: { color: '#ffc000', width: 0.75, style: 'solid' } },
  { label: '가는 실선 (초록)', pen: { color: '#70ad47', width: 0.75, style: 'solid' } },
  { label: '파선 (검정)', pen: { color: '#000000', width: 1, style: 'dashed' } },
  { label: '점선 (검정)', pen: { color: '#000000', width: 1, style: 'dotted' } },
  { label: '이중선 (검정)', pen: { color: '#000000', width: 3, style: 'double' } },
]

/** 대각선 테두리 — 워드의 「하향·상향 대각선 테두리」 */
export function applyDiagonal(editor: Editor, kind: 'down' | 'up' | 'both' | null): boolean {
  const rect = cellRect(editor)
  if (!rect) { flash('표 안에 커서를 두고 하세요'); return false }
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, 'data-diag': kind })
  }
  editor.view.dispatch(tr)
  const names = { down: '하향 대각선', up: '상향 대각선', both: '엇갈린 대각선' }
  flash(kind ? `${names[kind]} 테두리` : '대각선을 지웠다')
  return true
}

/**
 * 칸 안 글자 방향을 **바로 정한다** — 창에서 고를 때 쓴다.
 * (리본의 단추는 돌려 가며 바꾸는 cycleCellTextDirection 을 그대로 쓴다)
 */
export function setCellTextDirection(editor: Editor, dir: string | null): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, 'data-text-dir': dir })
  }
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

/** 세로 맞춤만 — 가로 맞춤(문단의 textAlign)은 건드리지 않는다 */
export function setCellValign(editor: Editor, vertical: 'top' | 'middle' | 'bottom' | null): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, valign: vertical })
  }
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

/** 칸 안 글자 방향 — 워드의 「텍스트 방향 변경」 (가로 → 세로 → 반대 세로) */
export function cycleCellTextDirection(editor: Editor): boolean {
  const rect = cellRect(editor)
  if (!rect) return false
  const cells = cellsInRect(editor, rect)
  if (!cells.length) return false
  const order = [null, 'vertical', 'vertical-rl']
  const names: Record<string, string> = { 'null': '가로', vertical: '세로쓰기', 'vertical-rl': '세로 (반대 방향)' }
  const now = String(cells[0].node.attrs['data-text-dir'] ?? 'null')
  const next = order[(order.indexOf(now === 'null' ? null : now) + 1) % order.length]
  let tr = editor.state.tr
  for (const cell of cells) {
    tr = tr.setNodeMarkup(cell.pos, undefined, { ...cell.node.attrs, 'data-text-dir': next })
  }
  editor.view.dispatch(tr)
  flash(`글자 방향 — ${names[String(next)]}`)
  return true
}
