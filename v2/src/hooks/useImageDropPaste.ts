import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { resolveBlobRefToObjectUrl, resolveBlobRefsInElement, saveDataUrlAsBlobRef } from '../lib/blobRefs'
import { decodeBeforeInsert } from '../lib/imageWord'

const MAX_BYTES = 25 * 1024 * 1024

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function useImageDropPaste(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom

    async function insertFile(file: File) {
      if (!editor || !file.type.startsWith('image/')) return
      if (file.size > MAX_BYTES) {
        alert(`이미지가 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB). 25MB 이하만 지원합니다.`)
        return
      }

      try {
        const dataUrl = await fileToDataUrl(file)
        const ref = await saveDataUrlAsBlobRef(dataUrl)
        /* 넣기 전에 미리 풀어 둔다 — 디코딩이 조판과 함께 돌면 그 사이 타자가 늦어진다
           (재어 보니 4000×3000 WebP 에서 가장 오래 붙들린 프레임 254ms → 40ms, 바닥값 18ms).
           풀어 둘 것은 화면에 실제로 물릴 주소여야 한다. 저장소 주소는 화면에 1×1 빈 그림으로
           나갔다가 object 주소로 바뀌므로, data: 주소를 풀어 두면 헛일이 된다 —
           브라우저는 주소가 다르면 다시 푼다(재어 보니 그대로 250ms 였다).
           여기서 미리 만들어 두는 object 주소는 blobRefs 가 기억해 두었다가 그대로 쓴다. */
        await decodeBeforeInsert(await resolveBlobRefToObjectUrl(ref) ?? dataUrl)
        editor.chain().focus().setImage({ src: ref }).run()
        window.setTimeout(() => {
          resolveBlobRefsInElement(editor.view.dom).catch(() => {})
        }, 0)
      } catch (e) {
        console.warn('[image] failed to read', e)
      }
    }

    function onDrop(e: DragEvent) {
      const files = e.dataTransfer?.files
      if (!files?.length) return
      const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (!images.length) return
      e.preventDefault()
      images.forEach(insertFile)
    }

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        e.preventDefault()
        insertFile(file)
        return
      }
    }

    dom.addEventListener('drop', onDrop)
    dom.addEventListener('paste', onPaste)
    return () => {
      dom.removeEventListener('drop', onDrop)
      dom.removeEventListener('paste', onPaste)
    }
  }, [editor])
}
