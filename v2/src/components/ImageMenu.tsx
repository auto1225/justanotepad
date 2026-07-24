import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface ImageMenuProps {
  editor: Editor | null
}

/**
 * Phase 16 — 이미지 인라인 메뉴.
 * 이미지 노드 선택 시 위에 떠다니는 컨트롤: 크기 (S/M/L/Full), 정렬 (왼/가운데/오른쪽), 삭제.
 */
export function ImageMenu({ editor }: ImageMenuProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!editor) return
    function update() {
      if (!editor) return
      const isImg = editor.isActive('image')
      if (!isImg) { setShow(false); return }
      try {
        const sel = editor.state.selection
        const coords = editor.view.coordsAtPos(sel.from)
        setPos({ x: coords.left, y: Math.max(coords.top - 40, 8) })
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

  function setSize(width: string) {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', { width }).run()
  }
  function setAlign(side: 'left' | 'center' | 'right') {
    if (!editor) return
    // 이미지 정렬은 부모 paragraph 의 textAlign 으로 적용
    // 이미지가 NodeSelection 상태면 setTextAlign 이 부모 문단에 닿지 않는다 —
    // 커서를 문단 안으로 옮겨 적용 후 이미지 선택 복원
    const pos = editor.state.selection.from
    editor.chain().focus().setTextSelection(pos).setTextAlign(side).setNodeSelection(pos).run()
  }

  if (!show || !editor) return null

  return (
    <div
      className="jan-image-menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 600 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => setSize('200px')} title="작게">S</button>
      <button onClick={() => setSize('400px')} title="중간">M</button>
      <button onClick={() => setSize('600px')} title="크게">L</button>
      <button onClick={() => setSize('100%')} title="전체 너비">Full</button>
      <span className="divider" />
      <button onClick={() => setAlign('left')} title="왼쪽">L</button>
      <button onClick={() => setAlign('center')} title="가운데">C</button>
      <button onClick={() => setAlign('right')} title="오른쪽">R</button>
      <span className="divider" />
      <button
        onClick={() => {
          const src = editor.getAttributes('image').src as string | undefined
          const pos = editor.state.selection.from
          if (src) window.dispatchEvent(new CustomEvent('jan-edit-image-in-paint', { detail: { src, pos } }))
        }}
        title="그림판에서 주석 편집 (화살표·박스·텍스트)"
      >주석</button>
      <span className="divider" />
      <button onClick={() => editor.chain().focus().deleteSelection().run()} title="삭제">×</button>
    </div>
  )
}
