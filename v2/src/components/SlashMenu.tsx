import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { PAGE_BREAK_HTML } from '../lib/pageBreak'

interface SlashMenuProps {
  editor: Editor | null
}

interface SlashItem {
  label: string
  hint?: string
  run: (editor: Editor) => void
}

/**
 * Phase 9 — Notion 스타일 / 슬래시 메뉴.
 * 빈 줄 첫 글자가 / 이고 selection 이 비어있으면 popup 표시.
 * ↑↓ Enter Esc.
 */
const ITEMS: SlashItem[] = [
  { label: '제목 1', hint: 'H1', run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: '제목 2', hint: 'H2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: '제목 3', hint: 'H3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '글머리 기호', run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '번호 매기기', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '체크리스트', run: (e) => e.chain().focus().toggleList('taskList', 'taskItem').run() },
  { label: '인용', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: '코드 블록', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: '구분선', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: '페이지 구분', hint: 'Ctrl+Enter', run: (e) => e.chain().focus().insertContent(PAGE_BREAK_HTML).run() },
  { label: '표 (3×3)', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: '콜아웃: 정보', run: (e) => e.chain().focus().setCallout('info').run() },
  { label: '콜아웃: 경고', run: (e) => e.chain().focus().setCallout('warn').run() },
  { label: '콜아웃: 팁', run: (e) => e.chain().focus().setCallout('tip').run() },
  { label: '수식 (LaTeX)', run: (e) => {
    const tex = window.prompt('LaTeX:')
    if (tex) e.chain().focus().setMath(tex).run()
  }},
  { label: '다이어그램 (Mermaid)', run: (e) => {
    const code = window.prompt('Mermaid:', 'graph TD\n  A-->B')
    if (code) e.chain().focus().setMermaid(code).run()
  }},
  { label: '임베드 (URL)', run: (e) => {
    const url = window.prompt('URL:')
    if (url) e.chain().focus().setEmbed(url).run()
  }},
  { label: '이미지 URL', run: (e) => {
    const url = window.prompt('이미지 URL:')
    if (url) e.chain().focus().setImage({ src: url }).run()
  }},
]

export function SlashMenu({ editor }: SlashMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const slashStartRef = useRef<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return ITEMS.filter((it) => it.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (!editor) return
    function onUpdate() {
      if (!editor) return
      const { selection } = editor.state
      if (!selection.empty) { setOpen(false); return }
      // 현재 위치 앞쪽 텍스트에서 / 찾기
      const $from = selection.$from
      const before = $from.parent.textBetween(0, $from.parentOffset, '\u0000', '\u0000')
      const m = before.match(/(?:^|\s)\/(\S*)$/)
      if (m) {
        const q = m[1]
        setQuery(q)
        slashStartRef.current = $from.pos - m[0].length + (m[0].startsWith(' ') ? 1 : 0)
        // 위치 계산
        try {
          const view = editor.view
          const coords = view.coordsAtPos($from.pos)
          setPos({ x: coords.left, y: coords.bottom + 4 })
          setOpen(true)
          setSelected(0)
        } catch {
          setOpen(false)
        }
      } else {
        setOpen(false)
        slashStartRef.current = null
      }
    }
    editor.on('selectionUpdate', onUpdate)
    editor.on('update', onUpdate)
    return () => {
      editor.off('selectionUpdate', onUpdate)
      editor.off('update', onUpdate)
    }
  }, [editor])

  const execute = useCallback((item: SlashItem) => {
    if (!editor) return
    // / 와 그 뒤 query 제거
    const start = slashStartRef.current
    if (start != null) {
      editor.chain().focus().setTextSelection({ from: start, to: start + 1 + query.length }).deleteSelection().run()
    }
    item.run(editor)
    setOpen(false)
    setQuery('')
  }, [editor, query])

  useEffect(() => {
    if (!open || !editor) return
    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter' && filtered[selected]) {
        e.preventDefault()
        execute(filtered[selected])
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, filtered, selected, editor, execute])

  if (!open || !editor) return null

  return (
    <div
      className="jan-slash-menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.length === 0 && <div className="jan-slash-empty">결과 없음</div>}
      {filtered.map((it, i) => (
        <div
          key={it.label}
          className={'jan-slash-item' + (i === selected ? ' is-selected' : '')}
          onClick={() => execute(it)}
          onMouseEnter={() => setSelected(i)}
        >
          <span>{it.label}</span>
          {it.hint && <span className="jan-slash-hint">{it.hint}</span>}
        </div>
      ))}
    </div>
  )
}
