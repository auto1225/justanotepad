import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { aggregateColumn, tableToCsv, csvToRows, rowsToTableHtml } from '../lib/tableUtils'
import { flash } from '../lib/flash'
import { sortTableByCurrentColumn } from '../lib/tableSort'

interface TableMenuProps {
  editor: Editor | null
}

/**
 * Phase 11 — 표 인라인 도구 메뉴.
 * 커서가 표 안에 있을 때 우상단에 떠다니는 작은 버튼 셋:
 * 행 추가/삭제 + 열 추가/삭제 + 표 삭제.
 */
export function TableMenu({ editor }: TableMenuProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!editor) return
    function update() {
      if (!editor) return
      const inTable = editor.isActive('table')
      if (!inTable) { setShow(false); return }
      try {
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        // 약간 위쪽
        setPos({ x: coords.left, y: Math.max(coords.top - 38, 8) })
        setShow(true)
      } catch {
        setShow(false)
      }
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  if (!show || !editor) return null

  return (
    <div
      className="jan-table-menu"
      ref={(el) => {
        /* 넓은 표에서는 말풍선 오른쪽 끝이 화면 밖으로 나가 마지막 버튼을 누를 수 없다 —
           그릴 때마다 화면 안으로 끌어당긴다. */
        if (!el) return
        const w = el.offsetWidth
        const max = Math.max(8, window.innerWidth - w - 8)
        const left = Math.min(Math.max(8, pos.x), max)
        el.style.left = `${Math.round(left)}px`
      }}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 500, maxWidth: 'calc(100vw - 16px)', flexWrap: 'wrap' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => editor.chain().focus().addRowBefore().run()} title="위 행 추가">↑+</button>
      <button onClick={() => editor.chain().focus().addRowAfter().run()} title="아래 행 추가">↓+</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()} title="현재 행 삭제">행×</button>
      <span className="divider" />
      <button onClick={() => editor.chain().focus().addColumnBefore().run()} title="왼쪽 열 추가">←+</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="오른쪽 열 추가">→+</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()} title="현재 열 삭제">열×</button>
      <span className="divider" />
      <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="헤더 행 토글">H</button>
      <button onClick={() => editor.chain().focus().mergeOrSplit().run()} title="셀 병합/분리">⊞</button>
      {['#FFF3C4', '#FFE0DB', '#DCEEFF', '#E1F5E1', '#F0E6FF'].map((c) => (
        <button
          key={c}
          onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', c).run()}
          title={`셀 배경색 ${c}`}
          aria-label={`셀 배경색 ${c}`}
          style={{ width: 18, height: 18, padding: 0, background: c, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 3 }}
        />
      ))}
      <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()} title="셀 배경색 지우기" style={{ fontSize: 10 }}>배경×</button>
      <button onClick={() => { if (confirm('표 전체 삭제?')) editor.chain().focus().deleteTable().run() }} title="표 삭제">표×</button>
      <span className="divider" />
      <button onClick={() => aggregateColumn(editor, 'sum')} title="현재 열 합계">Σ</button>
      <button onClick={() => aggregateColumn(editor, 'avg')} title="현재 열 평균">x̄</button>
      <button onClick={() => aggregateColumn(editor, 'min')} title="최소">↓</button>
      <button onClick={() => aggregateColumn(editor, 'max')} title="최대">↑</button>
      <button onClick={() => aggregateColumn(editor, 'count')} title="현재 열 개수">#</button>
      <span className="divider" />
      <button onClick={() => {
        const csv = tableToCsv(editor)
        if (!csv) return
        navigator.clipboard.writeText(csv).then(() => flash('CSV 를 클립보드에 복사했습니다')).catch(() => flash('클립보드 복사 실패'))
      }} title="표를 CSV로">CSV→</button>
      <button onClick={() => {
        const csv = window.prompt('CSV 텍스트를 붙여넣으세요:')
        if (!csv) return
        const rows = csvToRows(csv)
        if (rows.length === 0) return
        editor.chain().focus().deleteTable().insertContent(rowsToTableHtml(rows)).run()
      }} title="CSV → 표">→CSV</button>
    
      <span className="divider" />
      <button onClick={() => sortTableByCurrentColumn(editor, 'asc')} title="현재 열 오름차순">A↑</button>
      <button onClick={() => sortTableByCurrentColumn(editor, 'desc')} title="현재 열 내림차순">A↓</button>
      </div>
  )
}
