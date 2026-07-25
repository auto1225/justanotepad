import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

/**
 * Phase 17 — 마지막 커서 위치 복원.
 * 메모 별 커서 위치를 localStorage 에 저장.
 * 메모 전환 시 자동 복원.
 */
const STORAGE = 'jan-v2-cursor'

interface CursorMap {
  [memoId: string]: number
}

function load(): CursorMap {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '{}') } catch { return {} }
}
function save(map: CursorMap) {
  try { localStorage.setItem(STORAGE, JSON.stringify(map)) } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
}

export function useCursorMemory(editor: Editor | null, memoId: string | null) {
  // 메모 전환 시 복원
  useEffect(() => {
    if (!editor || !memoId) return
    // setContent 가 마친 직후 복원 — setTimeout 으로 다음 tick
    const t = setTimeout(() => {
      if (!editor) return
      const map = load()
      const pos = map[memoId]
      if (pos != null && pos >= 0) {
        try {
          const docSize = editor.state.doc.content.size
          const safe = Math.min(pos, docSize - 1)
          editor.chain().focus().setTextSelection({ from: safe, to: safe }).scrollIntoView().run()
        } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
      }
    }, 50)
    return () => clearTimeout(t)
  }, [editor, memoId])

  // 커서 변경 시 저장 (debounce 1초)
  useEffect(() => {
    if (!editor || !memoId) return
    let timer: number | null = null
    function onSelectionUpdate() {
      if (!editor || !memoId) return
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const map = load()
        map[memoId] = editor!.state.selection.from
        save(map)
      }, 1000)
    }
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
      if (timer) window.clearTimeout(timer)
    }
  }, [editor, memoId])
}
