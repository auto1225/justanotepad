import { useState } from 'react'
import type { Editor } from '@tiptap/react'

interface ColorPickerProps {
  editor: Editor | null
}

const TEXT_COLORS = ['#222222', '#D32F2F', '#E65100', '#F9A825', '#388E3C', '#1976D2', '#7B1FA2', '#5D4037', '#777777']
const BG_COLORS = ['transparent', '#FFEB3B', '#FFCDD2', '#FFCC80', '#C8E6C9', '#BBDEFB', '#E1BEE7', '#D7CCC8']

/**
 * Phase 16 — 글자색 + 배경색 미니 피커.
 * Toolbar 또는 BubbleToolbar 안에 인라인 표시.
 */
export function ColorPicker({ editor }: ColorPickerProps) {
  const [open, setOpen] = useState<'text' | 'bg' | null>(null)
  if (!editor) return null

  function setText(c: string) {
    ;editor!.chain().focus().setColor(c).run()
    setOpen(null)
  }
  function unsetText() {
    ;editor!.chain().focus().unsetColor().run()
    setOpen(null)
  }
  function setBg(c: string) {
    if (c === 'transparent') {
      ;editor!.chain().focus().unsetHighlight().run()
    } else {
      ;editor!.chain().focus().toggleHighlight({ color: c }).run()
    }
    setOpen(null)
  }

  return (
    <span className="jan-color-picker">
      <button onClick={() => setOpen(open === 'text' ? null : 'text')} title="글자색" className="jan-cp-btn">
        <span style={{ borderBottom: '3px solid #D32F2F', padding: '0 2px' }}>A</span>
      </button>
      <button onClick={() => setOpen(open === 'bg' ? null : 'bg')} title="배경/형광색" className="jan-cp-btn">
        <span style={{ background: '#FFEB3B', padding: '0 4px', borderRadius: 2 }}>A</span>
      </button>
      {open === 'text' && (
        <div className="jan-cp-pop" onMouseDown={(e) => e.preventDefault()}>
          {TEXT_COLORS.map((c) => (
            <button key={c} className="jan-cp-swatch" style={{ background: c }} onClick={() => setText(c)} aria-label={c} />
          ))}
          <button className="jan-cp-clear" onClick={unsetText}>지우기</button>
        </div>
      )}
      {open === 'bg' && (
        <div className="jan-cp-pop" onMouseDown={(e) => e.preventDefault()}>
          {BG_COLORS.map((c) => (
            <button
              key={c}
              className="jan-cp-swatch"
              style={{ background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#fff,#fff 4px,#ddd 4px,#ddd 8px)' : c }}
              onClick={() => setBg(c)}
              aria-label={c}
            />
          ))}
        </div>
      )}
    </span>
  )
}
