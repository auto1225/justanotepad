import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Icon } from './Icons'

interface BubbleToolbarProps {
  editor: Editor | null
}

/**
 * Phase 15 — 텍스트 선택 시 떠다니는 미니 툴바.
 * 위치: 선택 영역 위. 굵게/기울임/밑줄/취소선/형광/링크/AI.
 */
export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!editor) return
    function update() {
      if (!editor) return
      const sel = editor.state.selection
      if (sel.empty) { setShow(false); return }
      try {
        const { from, to } = sel
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const x = (start.left + end.right) / 2
        const y = Math.max(start.top - 44, 8)
        setPos({ x, y })
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

  const isB = editor.isActive('bold')
  const isI = editor.isActive('italic')
  const isU = editor.isActive('underline')
  const isS = editor.isActive('strike')
  const isH = editor.isActive('highlight')

  return (
    <div
      className="jan-bubble-toolbar"
      style={{ position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)', zIndex: 600 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={isB ? 'is-active' : ''} title="Ctrl+B"><b>B</b></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={isI ? 'is-active' : ''} title="Ctrl+I"><i>I</i></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={isU ? 'is-active' : ''} title="Ctrl+U"><u>U</u></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={isS ? 'is-active' : ''}><s>S</s></button>
      <button onClick={() => (editor.chain() as any).focus().toggleHighlight({ color: '#FFEB3B' }).run()} className={isH ? 'is-active' : ''} title="형광펜"><mark style={{ background: '#FFEB3B', padding: 0 }}>H</mark></button>
      <span className="divider" />
      <button onClick={() => window.dispatchEvent(new CustomEvent('jan-open-link-editor'))} title="링크 (Ctrl+K)" aria-label="링크 편집"><Icon name="link" size={13} /></button>
    </div>
  )
}
