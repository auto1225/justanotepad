import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { CellSelection } from 'prosemirror-tables'
import { distributeColumns, distributeRows, moveRow, resizeColumns, resizeRows } from '../lib/tableWord'
import {
  cellSelectionSize, collapseCellSelection, extendCellSelection, keepCellSelection,
  selectCurrentCell, selectTableColumn, selectTableRow, selectWholeTable,
} from '../lib/tableSelect'
import { flash } from '../lib/flash'

/**
 * 표 키보드 조작 — 마우스 없이도 표를 다 다룰 수 있게.
 *
 * 수식어(Ctrl·Shift·Alt)는 **하나만** 쓴다. 셋을 함께 누르는 조합은 손이 꼬여
 * 실제로는 아무도 쓰지 않는다. 그래서 표 안에서는 Alt 를 표 전용 수식어로 삼았다 —
 * 워드가 이미 Alt+Home/End, Shift+Alt+↑↓ 를 표에 쓰고 있어 결도 맞는다.
 *
 * 표 밖에서는 아무것도 가로채지 않는다 (inTable 로 막는다).
 */
/**
 * 여러 칸을 고른 채 글자를 치면 — 워드·한글은 **고른 칸을 모두 비우고 첫 칸에** 글자를 넣는다.
 *
 * 우리는 그러지 않았다. 2×2 를 골라 「가」 를 치면 고른 네 칸 가운데 **끝 칸 하나만** 덮어쓰고
 * 나머지 셋은 옛 글을 그대로 안고 있었다 (실측: 00·01·02·10·11·12 → 00·01·02·10·가·12).
 * 표 구조가 무너지지는 않았지만, 지운 줄 알았던 글이 남아 있는 것이 더 나쁘다.
 *
 * 고른 네모를 비우고 첫 칸에 커서를 놓은 트랜잭션을 만든다 (넣을 글은 부르는 쪽이 얹는다).
 */
function 고른칸비우기(state: EditorState): { tr: Transaction; 첫칸안: number } | null {
  const sel = state.selection
  if (!(sel instanceof CellSelection)) return null
  const 칸: { pos: number; node: PMNode }[] = []
  sel.forEachCell((node, pos) => { 칸.push({ pos, node }) })
  if (!칸.length) return null

  const tr = state.tr
  const 빈문단 = state.schema.nodes.paragraph
  // 뒤에서부터 비운다 — 앞을 먼저 건드리면 뒤 칸의 자리가 어긋난다
  for (let i = 칸.length - 1; i >= 0; i--) {
    const { pos, node } = 칸[i]
    if (이미빈칸(node)) continue // 빈 칸을 또 비우면 되돌리기에 빈 걸음만 쌓인다
    const 새속 = 빈문단?.createAndFill()
    if (!새속) continue
    tr.replaceWith(pos + 1, pos + node.nodeSize - 1, 새속)
  }
  // 첫 칸(문서 차례로 맨 앞) 안의 빈 문단에 커서를 놓는다
  const 첫칸안 = tr.mapping.map(칸[0].pos + 2)
  tr.setSelection(TextSelection.create(tr.doc, 첫칸안))
  return { tr, 첫칸안 }
}

/** 빈 문단 하나만 든 칸 — 비워 봐야 달라질 것이 없다 */
function 이미빈칸(node: PMNode): boolean {
  const 속 = node.firstChild
  return node.childCount === 1 && !!속 && 속.type.name === 'paragraph' && 속.content.size === 0
}

/**
 * 고른 칸을 비운 뒤에도 고른 네모를 그대로 둔다.
 *
 * 일부 칸만 고르고 Delete 를 눌렀을 때는 이미 그렇게 돌고 있었다 (실측: 지운 뒤에도
 * .selectedCell 이 4개 그대로). 표 전체를 골랐을 때만 다르게 굴면 그것이 더 놀랍다.
 */
function 고른네모되살리기(tr: Transaction, sel: CellSelection) {
  try {
    const 닻 = tr.doc.resolve(tr.mapping.map(sel.$anchorCell.pos))
    const 머리 = tr.doc.resolve(tr.mapping.map(sel.$headCell.pos))
    tr.setSelection(new CellSelection(닻, 머리))
  } catch {
    /* 못 되살리면 첫 칸에 놓인 커서를 그대로 둔다 — 글을 이어 칠 수는 있다 */
  }
}

export const TableKeymap = Extension.create({
  name: 'janTableKeymap',

  /* 글자 입력은 단축키로 가로챌 수 없다 — 입력 자리에서 직접 받는다 */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('janTableCellTyping'),
        props: {
          handleTextInput(view, _from, _to, text) {
            const 비움 = 고른칸비우기(view.state)
            if (!비움) return false
            비움.tr.insertText(text, 비움.첫칸안)
            view.dispatch(비움.tr)
            return true
          },
        },
      }),
    ]
  },

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

    /** 행·열의 처음·끝 칸으로 (워드의 Alt+Home / Alt+End / Alt+PgUp / Alt+PgDn) */
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

    /** 지금 고른 것이 열이면 열을, 아니면 행을 지운다 */
    const deleteHere = () => {
      if (!inTable()) return false
      const sel = this.editor.state.selection
      const isCol = sel instanceof CellSelection && sel.isColSelection()
      return isCol ? this.editor.chain().focus().deleteColumn().run() : this.editor.chain().focus().deleteRow().run()
    }

    const guard = (fn: () => boolean) => () => (inTable() ? fn() : false)

    /** 고른 칸의 내용만 비운다 (칸도 표도 남는다) */
    const 고른칸지우기 = () => {
      const sel = this.editor.state.selection
      if (!(sel instanceof CellSelection)) return false
      const 비움 = 고른칸비우기(this.editor.state)
      // 이미 다 비어 있어도 「지웠다」 로 친다 — 여기서 물러나면 표가 통째로 지워진다
      if (!비움 || !비움.tr.docChanged) return true
      고른네모되살리기(비움.tr, sel)
      this.editor.view.dispatch(비움.tr)
      return true
    }

    return {
      /* ── 크기: Alt + 방향키 (수식어 하나) ── */
      'Alt-ArrowRight': guard(() => keepCellSelection(this.editor, () => resizeColumns(this.editor, 8))),
      'Alt-ArrowLeft': guard(() => keepCellSelection(this.editor, () => resizeColumns(this.editor, -8))),
      'Alt-ArrowDown': guard(() => keepCellSelection(this.editor, () => resizeRows(this.editor, 8))),
      'Alt-ArrowUp': guard(() => keepCellSelection(this.editor, () => resizeRows(this.editor, -8))),

      /* ── 고른 칸 넓히기·좁히기 — 워드의 Shift+방향키 ── */
      'Shift-ArrowRight': guard(() => extendCellSelection(this.editor, 0, 1)),
      'Shift-ArrowLeft': guard(() => extendCellSelection(this.editor, 0, -1)),
      'Shift-ArrowDown': guard(() => extendCellSelection(this.editor, 1, 0)),
      'Shift-ArrowUp': guard(() => extendCellSelection(this.editor, -1, 0)),
      Escape: guard(() => collapseCellSelection(this.editor)),

      /* 고른 칸이 있을 때 Enter — 워드·한글은 고른 칸을 비우고 첫 칸으로 커서를 옮긴다.
         예전에는 아무 일도 일어나지 않아 (실측: 글자도 문단도 그대로) 눌러도 소용이 없었다. */
      Enter: () => {
        const 비움 = 고른칸비우기(this.editor.state)
        if (!비움) return false
        this.editor.view.dispatch(비움.tr)
        return true
      },

      /* 고른 칸에서 Delete — 워드는 **칸은 남기고 내용만** 비운다.
         우리는 표 전체를 골랐을 때(Alt+A)만 표가 통째로 사라졌다
         (실측: table 1→0 · td 9→0 · 「A|B|C|D|E|F|G|H|I」 → 「」).
         tiptap 의 표 확장이 「모든 칸이 골라졌으면 표를 지운다」 를 Delete 에 걸어 둔 탓이다.
         일부 칸만 골랐을 때는 이미 내용만 비우고 있었다 (실측: → 「||C|||F|G|H|I」, 표 그대로).
         이제 두 자리를 하나로 맞춘다 — 표를 지우는 길은 워드와 같이 **Backspace** 와
         리본의 「표 삭제」 로 남는다 (워드도 Delete 는 비우고 Backspace 는 지운다). */
      Delete: () => 고른칸지우기(),
      'Mod-Delete': () => 고른칸지우기(),

      /* ── 칸 사이 건너뛰기 — 워드와 같은 자리 ── */
      'Alt-Home': toEdgeCell('rowStart'),
      'Alt-End': toEdgeCell('rowEnd'),
      'Alt-PageUp': toEdgeCell('colStart'),
      'Alt-PageDown': toEdgeCell('colEnd'),

      /* ── 행 옮기기 — 워드의 Shift+Alt+↑/↓ ── */
      'Shift-Alt-ArrowUp': guard(() => moveRow(this.editor, -1)),
      'Shift-Alt-ArrowDown': guard(() => moveRow(this.editor, 1)),

      /* ── 선택: Alt + 글자 ── */
      'Alt-r': guard(() => { const { row } = here(); return row >= 0 && selectTableRow(this.editor, row) }),
      'Alt-c': guard(() => { const { col } = here(); return col >= 0 && selectTableColumn(this.editor, col) }),
      'Alt-a': guard(() => selectWholeTable(this.editor)),
      /* 칸 하나만 고르기 — 워드 「선택 › 셀 선택」 (표 안에서만 듣는다) */
      'Alt-s': guard(() => selectCurrentCell(this.editor)),
      /* 몇 칸을 골랐는지 알려 준다 */
      'Alt-;': guard(() => {
        const size = cellSelectionSize(this.editor)
        flash(size ? `${size.rows}행 ${size.cols}열 — ${size.rows * size.cols}칸 골랐다` : '고른 칸이 없다 — Alt+S 로 칸을 고른다')
        return true
      }),

      /* ── 넣고 빼기 (Shift 를 더하면 반대쪽) ── */
      'Alt-i': guard(() => this.editor.chain().focus().addRowAfter().run()),
      'Alt-I': guard(() => this.editor.chain().focus().addRowBefore().run()),
      'Alt-o': guard(() => this.editor.chain().focus().addColumnAfter().run()),
      'Alt-O': guard(() => this.editor.chain().focus().addColumnBefore().run()),
      'Alt-Backspace': deleteHere,
      'Alt-Delete': deleteHere,

      /* ── 병합·분할 ── */
      'Alt-m': guard(() => this.editor.chain().focus().mergeCells().run()),
      'Alt-M': guard(() => this.editor.chain().focus().splitCell().run()),

      /* ── 크기 같게 (고른 열·행만) ── */
      'Alt-e': guard(() => keepCellSelection(this.editor, () => distributeColumns(this.editor))),
      'Alt-E': guard(() => keepCellSelection(this.editor, () => distributeRows(this.editor))),

      /* ── 무엇을 쓸 수 있는지 ── */
      'Alt-/': guard(() => {
        flash(
          '표 단축키 (모두 Alt 하나) — ' +
          '←→ 열 너비 · ↑↓ 행 높이 · R/C/A 행·열·표 선택 · I 행 추가(Shift+I 위) · O 열 추가(Shift+O 왼쪽) · ' +
          '⌫ 삭제 · M 병합(Shift+M 분할) · E 열 같게(Shift+E 행 같게) · S 칸 하나 고르기 · '
          + 'Shift+방향키 고른 칸 넓히기 · Esc 선택 풀기 · Home/End·PgUp/PgDn 칸 끝 · ' +
          'Shift+↑↓ 행 이동 · Shift+F10 메뉴',
          8000
        )
        return true
      }),
    }
  },
})
