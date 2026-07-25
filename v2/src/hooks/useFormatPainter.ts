import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Phase 17 — 서식 복사기.
 * Ctrl+Shift+C: 현재 selection 의 marks (bold/italic/underline/...) 복사
 * Ctrl+Shift+V: 다음 selection 에 marks 적용 (단, 일반 paste 인 Ctrl+V 와 충돌 X — Shift 차이)
 *
 * Word 의 "Format Painter" 와 동일 UX.
 */
interface SavedFormat {
  marks: Array<{ type: string; attrs: Record<string, unknown> }>
  textAlign?: string
}

export function useFormatPainter(editor: Editor | null) {
  const saved = useRef<SavedFormat | null>(null)

  useEffect(() => {
    if (!editor) return

    function copy() {
      if (!editor) return
      const sel = editor.state.selection
      if (sel.empty) return
      // 현재 위치의 marks
      const marks = editor.state.doc.resolve(sel.from).marks()
      const ta = editor.getAttributes('paragraph').textAlign || editor.getAttributes('heading').textAlign
      saved.current = {
        marks: marks.map((m) => ({ type: m.type.name, attrs: m.attrs })),
        textAlign: ta,
      }
      flashIndicator('서식 복사됨')
    }

    function paste() {
      if (!editor || !saved.current) return
      const sel = editor.state.selection
      if (sel.empty) return
      const chain = editor.chain().focus().setTextSelection({ from: sel.from, to: sel.to })
      // 모든 marks 제거 후 다시 적용 (단순화)
      chain.unsetAllMarks()
      for (const mark of saved.current.marks) {
        try {
          chain.setMark(mark.type, mark.attrs)
        } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
      }
      if (saved.current.textAlign) chain.setTextAlign(saved.current.textAlign)
      chain.run()
      flashIndicator('서식 적용됨')
    }

    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        const sel = editor?.state.selection
        if (sel && !sel.empty) { e.preventDefault(); copy() }
      } else if (ctrl && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        if (saved.current) { e.preventDefault(); paste() }
      }
    }
    // 메뉴에서도 실행할 수 있도록 커스텀 이벤트 통로 제공
    const onCopyEvt = () => {
      const sel = editor?.state.selection
      if (sel && !sel.empty) copy()
      else flashIndicator('먼저 서식을 복사할 텍스트를 선택하세요')
    }
    const onPasteEvt = () => {
      if (saved.current) paste()
      else flashIndicator('복사된 서식이 없습니다 — 먼저 "서식 복사"를 실행하세요')
    }
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('jan-format-copy', onCopyEvt)
    window.addEventListener('jan-format-paste', onPasteEvt)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('jan-format-copy', onCopyEvt)
      window.removeEventListener('jan-format-paste', onPasteEvt)
    }
  }, [editor])
}

function flashIndicator(text: string) {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#5D4037;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s;'
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1' })
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200) }, 1200)
}
