import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useMacrosStore, expandVars } from '../store/macrosStore'

/**
 * Phase 12 — 매크로 자동 확장.
 * editor.update 마다 현재 단어 끝부분이 매크로 trigger 와 일치하면 즉시 치환.
 */
export function useMacroExpansion(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return

    function tryExpand() {
      if (!editor) return
      const { selection } = editor.state
      if (!selection.empty) return
      const $from = selection.$from
      // 코드 블록 안에서는 확장하지 않는다 (';today' 같은 코드가 바뀌면 안 됨)
      if ($from.parent.type.name === 'codeBlock') return
      // 매크로 목록은 호출 시점에 읽는다 — 마운트 시 스냅샷을 잡으면
      // 매크로 추가/삭제가 새로고침 전까지 반영되지 않는다
      const macros = useMacrosStore.getState().macros
      const before = $from.parent.textBetween(0, $from.parentOffset, '\u0000', '\u0000')
      // trigger 가 단어 경계 끝에 있는지
      for (const m of macros) {
        if (before.endsWith(m.trigger)) {
          // 다음 입력이 공백/엔터인 경우 확장 — 하지만 우리는 즉시 트리거.
          // 사용자가 trigger 마지막 문자를 입력한 직후 호출됨.
          // 이전 위치 계산 해서 trigger 영역 삭제 후 expansion 삽입.
          const start = $from.pos - m.trigger.length
          const end = $from.pos
          const expanded = expandVars(m.expansion)
          editor
            .chain()
            .focus()
            .setTextSelection({ from: start, to: end })
            .deleteSelection()
            .insertContent(expanded)
            .run()
          break
        }
      }
    }

    editor.on('update', tryExpand)
    return () => {
      editor.off('update', tryExpand)
    }
  }, [editor])
}
