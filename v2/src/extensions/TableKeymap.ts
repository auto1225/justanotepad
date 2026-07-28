import { Extension } from '@tiptap/core'
import { CellSelection } from 'prosemirror-tables'
import { distributeColumns, distributeRows, moveRow, resizeColumns, resizeRows } from '../lib/tableWord'
import { selectTableColumn, selectTableRow, selectWholeTable } from '../lib/tableSelect'
import { flash } from '../lib/flash'

/**
 * 표 키보드 조작 — 마우스 없이도 표를 다 다룰 수 있게.
 *
 * 워드가 정해 둔 것은 그대로 따르고(Alt+Home/End, Alt+PageUp/Down, Shift+Alt+↑/↓),
 * 워드가 마우스로만 하던 것(행·열·표 선택, 균등 분배)은 같은 결의 단축키를 새로 둔다.
 * 상황 메뉴는 Shift+F10 으로 열린다 (브라우저가 contextmenu 이벤트를 보내 준다).
 */
export const TableKeymap = Extension.create({
  name: 'janTableKeymap',

  addKeyboardShortcuts() {
    const inTable = () => this.editor.isActive('table')

    /** 커서가 든 행·열 번호 */
    const here = () => {
      const { $from } = this.editor.state.selection
      let row = -1
      let col = -1
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d)
        if (node.type.name === 'tableRow' && row < 0) row = $from.index(d - 1)
        if (/^table(Cell|Header)$/.test(node.type.name) && col < 0) col = $from.index(d - 1)
      }
      return { row, col }
    }

    /** 행 안에서 첫/마지막 칸으로 (워드의 Alt+Home / Alt+End) */
    const toEdgeCell = (where: 'rowStart' | 'rowEnd' | 'colStart' | 'colEnd') => () => {
      if (!inTable()) return false
      const { $from } = this.editor.state.selection
      let tableDepth = -1
      for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') { tableDepth = d; break }
      if (tableDepth < 0) return false
      const table = $from.node(tableDepth)
      const tablePos = $from.before(tableDepth)
      const rows: number[][] = []
      table.forEach((row, rowOffset) => {
        if (row.type.name !== 'tableRow') return
        const line: number[] = []
        row.forEach((_cell, cellOffset) => line.push(tablePos + 1 + rowOffset + 1 + cellOffset))
        rows.push(line)
      })
      const { row, col } = here()
      if (row < 0 || col < 0) return false
      let target: number | undefined
      if (where === 'rowStart') target = rows[row]?.[0]
      else if (where === 'rowEnd') target = rows[row]?.[rows[row].length - 1]
      else if (where === 'colStart') target = rows[0]?.[col]
      else target = rows[rows.length - 1]?.[col]
      if (target == null) return false
      this.editor.commands.focus(target + 1)
      return true
    }

    return {
      /* 칸 사이 건너뛰기 — 워드와 같은 자리 */
      'Alt-Home': toEdgeCell('rowStart'),
      'Alt-End': toEdgeCell('rowEnd'),
      'Alt-PageUp': toEdgeCell('colStart'),
      'Alt-PageDown': toEdgeCell('colEnd'),

      /* 행 옮기기 — 워드의 Shift+Alt+↑/↓ */
      'Shift-Alt-ArrowUp': () => (inTable() ? moveRow(this.editor, -1) : false),
      'Shift-Alt-ArrowDown': () => (inTable() ? moveRow(this.editor, 1) : false),

      /* 선택 — 워드는 마우스로만 하던 것 */
      'Mod-Alt-r': () => { if (!inTable()) return false; const { row } = here(); return row >= 0 && selectTableRow(this.editor, row) },
      'Mod-Alt-c': () => { if (!inTable()) return false; const { col } = here(); return col >= 0 && selectTableColumn(this.editor, col) },
      'Mod-Alt-t': () => (inTable() ? selectWholeTable(this.editor) : false),

      /* 행·열 넣고 빼기 */
      'Mod-Alt-ArrowUp': () => (inTable() ? this.editor.chain().focus().addRowBefore().run() : false),
      'Mod-Alt-ArrowDown': () => (inTable() ? this.editor.chain().focus().addRowAfter().run() : false),
      'Mod-Alt-ArrowLeft': () => (inTable() ? this.editor.chain().focus().addColumnBefore().run() : false),
      'Mod-Alt-ArrowRight': () => (inTable() ? this.editor.chain().focus().addColumnAfter().run() : false),
      'Mod-Alt-Backspace': () => {
        if (!inTable()) return false
        // 고른 것이 열이면 열을, 아니면 행을 지운다
        const sel = this.editor.state.selection
        const isCol = sel instanceof CellSelection && sel.isColSelection()
        return isCol ? this.editor.chain().focus().deleteColumn().run() : this.editor.chain().focus().deleteRow().run()
      },

      /* 고른 칸의 크기를 방향키로 — 한 번에 8px, Shift 없이 세밀하게는 리본의 지정 값으로.
         (Shift+Alt+↑/↓ 은 워드의 행 옮기기라 크기 조절은 Ctrl 을 하나 더 쓴다) */
      'Mod-Alt-Shift-ArrowRight': () => (inTable() ? resizeColumns(this.editor, 8) : false),
      'Mod-Alt-Shift-ArrowLeft': () => (inTable() ? resizeColumns(this.editor, -8) : false),
      'Mod-Alt-Shift-ArrowDown': () => (inTable() ? resizeRows(this.editor, 8) : false),
      'Mod-Alt-Shift-ArrowUp': () => (inTable() ? resizeRows(this.editor, -8) : false),

      /* 균등 분배 — 고른 열·행만 (아무것도 안 골랐으면 표 전체)
         Shift 를 누르면 브라우저가 대문자 키 이름을 보내므로 두 가지로 모두 걸어 둔다 */
      'Mod-Alt-e': () => (inTable() ? distributeColumns(this.editor) : false),
      'Mod-Alt-Shift-e': () => (inTable() ? distributeRows(this.editor) : false),
      'Mod-Alt-Shift-E': () => (inTable() ? distributeRows(this.editor) : false),

      /* 셀 병합·분할 */
      'Mod-Alt-m': () => (inTable() ? this.editor.chain().focus().mergeCells().run() : false),
      'Mod-Alt-Shift-m': () => (inTable() ? this.editor.chain().focus().splitCell().run() : false),
      'Mod-Alt-Shift-M': () => (inTable() ? this.editor.chain().focus().splitCell().run() : false),

      /* 무엇을 쓸 수 있는지 알려 주는 안내 */
      'Mod-Alt-slash': () => {
        if (!inTable()) return false
        flash('표 단축키: Alt+Home/End 행 끝 · Alt+PgUp/PgDn 열 끝 · Ctrl+Alt+R/C/T 행·열·표 선택 · Ctrl+Alt+←↑↓→ 삽입 · Ctrl+Alt+⌫ 삭제 · Ctrl+Alt+M 병합 · Ctrl+Alt+Shift+←→ 열 너비, ↑↓ 행 높이 · Ctrl+Alt+E 같게 · Shift+F10 메뉴', 7000)
        return true
      },
    }
  },
})
