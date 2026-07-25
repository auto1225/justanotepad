import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { runAi, aiConfigured } from '../lib/aiApi'

/**
 * Phase 15 — AI ghost text 자동완성.
 * 사용자가 일정 시간 (1.5초) 멈추면 → AI 가 다음 문장 1줄 제안 → ghost text 로 표시.
 * Tab 으로 수락, Esc 로 거부.
 *
 * 트리거: settings 의 aiAutocomplete 가 true 일 때만.
 */
const TRIGGER_DELAY_MS = 1500
const MIN_CONTEXT = 30

export function useAiAutocomplete(editor: Editor | null, enabled: boolean) {
  const [ghost, setGhost] = useState('')
  const timerRef = useRef<number | null>(null)
  const ghostRef = useRef('')

  useEffect(() => {
    // 꺼져 있으면 아무것도 걸지 않는다 — 켜져 있던 유령 글자는 이전 effect 의 정리 단계에서 지워진다
    if (!editor || !enabled) return

    function clearTimer() {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
    }

    function schedule() {
      if (!editor || !aiConfigured()) return
      clearTimer()
      timerRef.current = window.setTimeout(async () => {
        const sel = editor.state.selection
        if (!sel.empty) return
        const before = editor.state.doc.textBetween(0, sel.from, ' ', ' ').trim()
        if (before.length < MIN_CONTEXT) return
        // 마지막 200자만 컨텍스트로
        const ctx = before.slice(-300)
        try {
          const r = await runAi('continue', ctx)
          if (r.ok && r.text) {
            const suggestion = r.text.split(/\n\n/)[0].trim().slice(0, 120)
            if (suggestion) {
              ghostRef.current = suggestion
              setGhost(suggestion)
              showGhostInDom(editor, suggestion)
            }
          }
        } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
      }, TRIGGER_DELAY_MS)
    }

    function onUpdate() {
      ghostRef.current = ''
      setGhost('')
      removeGhostFromDom()
      schedule()
    }

    function onKey(e: KeyboardEvent) {
      if (!ghostRef.current) return
      if (!editor) return; if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        editor.chain().focus().insertContent(ghostRef.current).run()
        ghostRef.current = ''
        setGhost('')
        removeGhostFromDom()
      } else if (e.key === 'Escape') {
        ghostRef.current = ''
        setGhost('')
        removeGhostFromDom()
      }
    }

    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onUpdate)
    document.addEventListener('keydown', onKey, true)

    return () => {
      clearTimer()
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onUpdate)
      document.removeEventListener('keydown', onKey, true)
      removeGhostFromDom()
      setGhost('')
    }
  }, [editor, enabled])

  return { ghost }
}

function showGhostInDom(editor: Editor, text: string) {
  removeGhostFromDom()
  try {
    const sel = editor.state.selection
    const coords = editor.view.coordsAtPos(sel.from)
    const span = document.createElement('span')
    span.id = 'jan-ai-ghost'
    span.textContent = text
    span.style.cssText = `position:fixed;left:${coords.left}px;top:${coords.top}px;color:#999;font-style:italic;pointer-events:none;z-index:100;background:rgba(255,255,255,0.6);padding:0 4px;border-radius:2px;font-size:12px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`
    document.body.appendChild(span)
  } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
}

function removeGhostFromDom() {
  const el = document.getElementById('jan-ai-ghost')
  if (el) el.remove()
}
