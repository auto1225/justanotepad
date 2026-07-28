import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { splitTable, tableToText } from '../lib/tableWord'
import { selectTableColumn, selectTableRow, selectWholeTable } from '../lib/tableSelect'
import { setCellFormula, suggestFormula } from '../lib/tableCompute'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
}

interface MenuItem {
  label: string
  hint?: string
  run?: () => void
  divider?: boolean
}

/**
 * 표 오른쪽 클릭 메뉴 — 워드에서 표를 오른쪽 클릭했을 때 나오는 것과 같은 갈래.
 * 리본까지 가지 않고 그 자리에서 삽입·삭제·병합·수식을 쓴다.
 */
export function TableContextMenu({ editor }: Props) {
  const [at, setAt] = useState<{ x: number; y: number; keyboard: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editor) return
    const onMenu = (e: MouseEvent) => {
      if (!editor.isActive('table')) return
      const target = e.target as HTMLElement | null
      /* Shift+F10 · 메뉴 키로 열면 좌표가 0 이거나 편집기 밖을 가리킨다 —
         그때는 커서 자리에 띄운다 (키보드만으로 쓰는 사람을 위해) */
      const byKeyboard = !e.clientX && !e.clientY
      if (!byKeyboard && !target?.closest?.('.ProseMirror table')) return
      e.preventDefault()
      if (byKeyboard) {
        const coords = editor.view.coordsAtPos(editor.state.selection.from)
        setAt({ x: coords.left, y: coords.bottom + 4, keyboard: true })
      } else {
        setAt({ x: e.clientX, y: e.clientY, keyboard: false })
      }
    }
    const close = () => setAt(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAt(null) }
    // 메뉴 키(⌨ Menu)로도 연다 — 브라우저가 contextmenu 를 보내지 않는 경우가 있다
    const onMenuKey = (e: KeyboardEvent) => {
      if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return
      if (!editor.isActive('table')) return
      e.preventDefault()
      const coords = editor.view.coordsAtPos(editor.state.selection.from)
      setAt({ x: coords.left, y: coords.bottom + 4, keyboard: true })
    }
    document.addEventListener('contextmenu', onMenu)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('keydown', onMenuKey)
    return () => {
      document.removeEventListener('contextmenu', onMenu)
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keydown', onMenuKey)
    }
  }, [editor])

  if (!editor || !at) return null

  /* 위아래 화살표로 항목을 옮겨 다닌다 (키보드만으로 쓰는 사람을 위해) */
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(menuRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(index + 1) % buttons.length].focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length].focus() }
    else if (e.key === 'Home') { e.preventDefault(); buttons[0].focus() }
    else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1].focus() }
    else if (e.key === 'Escape') { e.preventDefault(); setAt(null); editor.commands.focus() }
  }

  const chain = () => editor.chain().focus()
  const items: MenuItem[] = [
    { label: '위에 행 삽입', run: () => chain().addRowBefore().run() },
    { label: '아래에 행 삽입', run: () => chain().addRowAfter().run() },
    { label: '왼쪽에 열 삽입', run: () => chain().addColumnBefore().run() },
    { label: '오른쪽에 열 삽입', run: () => chain().addColumnAfter().run() },
    { label: '', divider: true },
    { label: '행 삭제', run: () => chain().deleteRow().run() },
    { label: '열 삭제', run: () => chain().deleteColumn().run() },
    { label: '표 삭제', run: () => chain().deleteTable().run() },
    { label: '', divider: true },
    { label: '셀 병합', run: () => chain().mergeCells().run() },
    { label: '셀 분할', run: () => chain().splitCell().run() },
    { label: '표 분할', hint: '커서 행에서 둘로', run: () => { splitTable(editor) } },
    { label: '', divider: true },
    { label: '행 선택', run: () => { const i = rowIndexOf(editor); if (i >= 0) selectTableRow(editor, i) } },
    { label: '열 선택', run: () => { const i = colIndexOf(editor); if (i >= 0) selectTableColumn(editor, i) } },
    { label: '표 전체 선택', run: () => selectWholeTable(editor) },
    { label: '', divider: true },
    {
      label: '수식 (fx)',
      hint: '=SUM(ABOVE)',
      run: () => {
        const suggested = suggestFormula(editor)
        const value = window.prompt('수식 — 예: =SUM(ABOVE) · =AVERAGE(LEFT) · =B2*C2', suggested)
        if (value === null) return
        setCellFormula(editor, value, '#,##0')
        flash(value ? '수식 적용' : '수식을 지웠습니다')
      },
    },
    { label: '표를 텍스트로', run: () => { tableToText(editor, '\t') } },
  ]

  // 화면 밖으로 나가지 않게 끌어당긴다
  const W = 190
  const H = Math.min(items.length * 28 + 12, window.innerHeight - 16)
  const left = Math.min(at.x, window.innerWidth - W - 8)
  const top = Math.min(at.y, window.innerHeight - H - 8)

  return (
    <div
      ref={(el) => {
        menuRef.current = el
        // 키보드로 열었으면 첫 항목에 바로 초점을 준다
        if (el && at.keyboard) (el.querySelector('button') as HTMLButtonElement | null)?.focus()
      }}
      className="jan-table-ctx"
      role="menu"
      style={{ left, top, width: W }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={'d' + i} className="jan-table-ctx-div" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => { item.run?.(); setAt(null); editor.commands.focus() }}
          >
            <span>{item.label}</span>
            {item.hint && <em>{item.hint}</em>}
          </button>
        )
      )}
    </div>
  )
}

/** 커서가 든 행의 순번 */
function rowIndexOf(editor: Editor): number {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name !== 'tableRow') continue
    return $from.index(d - 1)
  }
  return -1
}

/** 커서가 든 열의 순번 (병합은 셀 차례로 센다) */
function colIndexOf(editor: Editor): number {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!/^table(Cell|Header)$/.test(node.type.name)) continue
    return $from.index(d - 1)
  }
  return -1
}
