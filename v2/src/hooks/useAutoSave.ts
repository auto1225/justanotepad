import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useDocStore } from '../store/docStore'
import { saveToFile } from '../lib/fileOps'
import { pushActiveSnapshot } from '../lib/activeSync'
import { useMemosStore } from '../store/memosStore'
import { trackEvent } from '../lib/analytics'
import { getSavableHtml } from '../extensions/PageDocument'
import { pageSettingsFromUi, useUIStore } from '../store/uiStore'
import { flash } from '../lib/flash'

/**
 * Phase 10 — 자동 저장.
 * fileHandle 이 있을 때만 → 사용자가 한 번 명시 저장한 후 자동 저장.
 * 변경 → debounce 2초 → saveToFile.
 */
const DEBOUNCE_MS = 2000

export function useAutoSave(editor: Editor | null, title: string) {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return
    function onUpdate() {
      const { fileHandle, fileHandleMemoId } = useDocStore.getState()
      if (!fileHandle) return // 명시 저장 전엔 자동 저장 X
      // 핸들이 다른 메모의 파일이면 자동 저장하지 않는다 (그 파일을 덮어쓰게 됨)
      if (fileHandleMemoId && fileHandleMemoId !== useMemosStore.getState().currentId) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(async () => {
        if (!editor) return
        const { fileHandle: handleNow, fileHandleMemoId: ownerNow } = useDocStore.getState()
        const { currentId } = useMemosStore.getState()
        if (!handleNow || (ownerNow && ownerNow !== currentId)) return
        const html = getSavableHtml(editor)
        const result = await saveToFile({
          title, content: html, handle: handleNow,
          pageSettings: pageSettingsFromUi(useUIStore.getState()),
          silent: true, // 사람이 누른 저장이 아니다 — 창을 띄우거나 내려받기로 새면 안 된다
        })
        if (result.ok) {
          useDocStore.getState().setSavedAt(Date.now())
          if (currentId) pushActiveSnapshot(currentId).catch(() => {})
          trackEvent('autosave')
        } else if (result.needsPermission) {
          /* 그 파일에 더는 쓸 수 없다 (탭을 다시 연 뒤 허락이 풀린 경우다).
             손잡이를 놓아 자동 저장이 조용히 헛돌지 않게 하고, 한 번만 알린다 */
          useDocStore.getState().setFileHandle(null)
          flash('파일 쓰기 허락이 풀려 자동 저장을 멈췄습니다 — Ctrl+S 로 다시 저장해 주세요')
        }
      }, DEBOUNCE_MS)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [editor, title])
}
