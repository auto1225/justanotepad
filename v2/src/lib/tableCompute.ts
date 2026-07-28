import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import { evaluateFormula, formatNumber, type CellGrid } from './tableFormula'

/**
 * 표 안의 수식을 실제 문서에 적용한다.
 *
 * 워드는 수식을 필드로 넣어 두고 F9 를 눌러야 다시 계산하지만,
 * 여기서는 값이 바뀌면 스스로 다시 계산한다 — 표를 고치는 사람은
 * 대개 "지금 값"을 보고 싶어 하기 때문이다.
 */

interface CellInfo {
  /** 문서 안 위치 (셀 노드의 시작) */
  pos: number
  node: PMNode
  row: number
  col: number
}

/** 표 한 개를 훑어 칸 목록과 글자 격자를 만든다 (병합은 왼쪽 위 칸 기준) */
export function readTable(table: PMNode, tableStart: number): { cells: CellInfo[]; grid: CellGrid } {
  const cells: CellInfo[] = []
  const grid: CellGrid = []
  // rowspan 때문에 아래 줄에서 자리가 밀린다 — 차지한 자리를 표시해 둔다
  const taken = new Map<string, boolean>()
  let rowIndex = 0
  table.forEach((row, rowOffset) => {
    if (row.type.name !== 'tableRow') return
    const line: string[] = grid[rowIndex] || (grid[rowIndex] = [])
    let colIndex = 0
    row.forEach((cell, cellOffset) => {
      while (taken.get(`${rowIndex}:${colIndex}`)) colIndex++
      const pos = tableStart + 1 + rowOffset + 1 + cellOffset
      cells.push({ pos, node: cell, row: rowIndex, col: colIndex })
      line[colIndex] = cell.textContent
      const colspan = Number(cell.attrs.colspan) || 1
      const rowspan = Number(cell.attrs.rowspan) || 1
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if (r === 0 && c === 0) continue
          taken.set(`${rowIndex + r}:${colIndex + c}`, true)
          if (r === 0) line[colIndex + c] = ''
        }
      }
      colIndex += colspan
    })
    rowIndex++
  })
  return { cells, grid }
}

/** 칸 하나에 넣을 글자 — 수식이 있으면 계산 결과, 없으면 null */
function computedText(cell: CellInfo, grid: CellGrid): string | null {
  const formula = cell.node.attrs.formula as string | undefined
  if (!formula) return null
  const value = evaluateFormula(formula, { grid, row: cell.row, col: cell.col })
  if (value === null) return null
  return formatNumber(value, cell.node.attrs.numFormat as string | undefined)
}

/**
 * 문서 안의 모든 표를 다시 계산해 트랜잭션에 반영한다.
 *
 * 수식이 다른 수식의 결과를 다시 참조하는 일이 흔하다 (칸별 합계를 다시 총합으로 더하는 표).
 * 그래서 값이 더 바뀌지 않을 때까지 되풀이한다 — 서로 물고 도는 수식은 끝나지 않으므로
 * 횟수를 묶어 둔다 (그 경우 마지막 값이 그대로 남는다).
 * 반환: 손본 칸 수 (0 이면 아무것도 하지 않았다는 뜻)
 */
export function applyFormulas(tr: Transaction, maxRounds = 6): number {
  let total = 0
  for (let round = 0; round < maxRounds; round++) {
    const changed = applyFormulasOnce(tr)
    total += changed
    if (!changed) break
  }
  return total
}

function applyFormulasOnce(tr: Transaction): number {
  const jobs: Array<{ from: number; to: number; text: string; cell: CellInfo }> = []
  tr.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    const { cells, grid } = readTable(node, pos)
    for (const cell of cells) {
      const text = computedText(cell, grid)
      if (text === null) continue
      if (cell.node.textContent === text) continue
      // 칸 안의 첫 문단만 갈아 끼운다 (문단이 여럿이면 첫 줄에 값을 둔다)
      const inner = cell.node.firstChild
      if (!inner || !inner.isTextblock) continue
      const from = cell.pos + 2 // 셀 → 문단 → 글자
      jobs.push({ from, to: from + inner.content.size, text, cell })
    }
    return false
  })
  if (!jobs.length) return 0
  // 뒤에서부터 바꿔야 앞쪽 위치가 밀리지 않는다
  jobs.sort((a, b) => b.from - a.from)
  for (const job of jobs) {
    const text = job.text ? tr.doc.type.schema.text(job.text) : null
    if (text) tr.replaceWith(job.from, job.to, text)
    else tr.delete(job.from, job.to)
  }
  return jobs.length
}

/** 커서가 든 칸에 수식을 건다 (워드의 「수식」 대화상자에 해당) */
export function setCellFormula(editor: Editor, formula: string, numFormat: string): boolean {
  if (!editor.isActive('tableCell') && !editor.isActive('tableHeader')) return false
  const value = formula.trim()
  editor.chain().focus()
    .updateAttributes(editor.isActive('tableHeader') ? 'tableHeader' : 'tableCell', {
      formula: value ? (value.startsWith('=') ? value : '=' + value) : null,
      numFormat: numFormat || null,
    })
    .run()
  return true
}

/** 커서가 든 칸의 수식 (없으면 빈 문자열) */
export function currentCellFormula(editor: Editor): { formula: string; numFormat: string } {
  const type = editor.isActive('tableHeader') ? 'tableHeader' : 'tableCell'
  const attrs = editor.getAttributes(type)
  return { formula: (attrs.formula as string) || '', numFormat: (attrs.numFormat as string) || '' }
}

/**
 * 커서 칸 기준으로 워드가 제안하는 기본 수식.
 * 워드는 위쪽에 숫자가 있으면 =SUM(ABOVE), 아니면 왼쪽을 본다.
 */
export function suggestFormula(editor: Editor): string {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name !== 'table') continue
    const { cells, grid } = readTable(node, $from.before(d))
    const cellPos = (() => {
      for (let dd = d; dd <= $from.depth; dd++) {
        const n = $from.node(dd)
        if (/^table(Cell|Header)$/.test(n.type.name)) return $from.before(dd)
      }
      return -1
    })()
    const here = cells.find((c) => c.pos === cellPos)
    if (!here) break
    const hasNumberAbove = grid.slice(0, here.row).some((line) => /\d/.test(line[here.col] || ''))
    return hasNumberAbove ? '=SUM(ABOVE)' : '=SUM(LEFT)'
  }
  return '=SUM(ABOVE)'
}
