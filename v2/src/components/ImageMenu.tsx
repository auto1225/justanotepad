import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { currentImage, fitImageToBody, rotateImage, setImageAlign, setImageWidth, setImageWrap } from '../lib/imageWord'

interface ImageMenuProps {
  editor: Editor | null
}

/**
 * 그림 위에 뜨는 작은 막대 — 워드에서 그림 옆에 붙는 「레이아웃 옵션」 단추와 같은 자리.
 * 자주 쓰는 것만 둔다. 나머지는 리본 「그림」 탭·오른쪽 클릭 메뉴·Alt 단축키에 있다.
 */
export function ImageMenu({ editor }: ImageMenuProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (!editor) return
    function update() {
      if (!editor) return
      if (!currentImage(editor)) { setShow(false); return }
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

  if (!show || !editor) return null
  const dialog = (tab: string) => window.dispatchEvent(new CustomEvent('jan-image-dialog', { detail: { tab } }))

  return (
    <div
      className="jan-image-menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 600 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => setImageWidth(editor, '200px')} title="작게 (200px)">S</button>
      <button onClick={() => setImageWidth(editor, '400px')} title="중간 (400px)">M</button>
      <button onClick={() => setImageWidth(editor, '600px')} title="크게 (600px)">L</button>
      <button onClick={() => fitImageToBody(editor)} title="본문 너비에 맞춤 (Alt+F)">Full</button>
      <span className="divider" />
      <button onClick={() => setImageAlign(editor, 'left')} title="왼쪽 맞춤">L</button>
      <button onClick={() => setImageAlign(editor, 'center')} title="가운데 맞춤">C</button>
      <button onClick={() => setImageAlign(editor, 'right')} title="오른쪽 맞춤">R</button>
      <span className="divider" />
      <button onClick={() => setImageWrap(editor, 'inline', '배치: 글자처럼 취급')} title="글자처럼 취급 (Alt+W 로 차례로 바꾼다)">글자처럼</button>
      <button onClick={() => dialog('layout')} title="텍스트 배치와 위치">배치</button>
      <button onClick={() => window.dispatchEvent(new Event('jan-image-crop-mode'))} title="자르기 손잡이 켜기/끄기">자르기</button>
      <button onClick={() => rotateImage(editor, 90)} title="오른쪽으로 90° 회전 (Alt+R)">⟳</button>
      <span className="divider" />
      <button onClick={() => dialog('caption')} title="캡션 — 그림과 함께 움직인다 (Alt+C)">캡션</button>
      <button onClick={() => dialog('alt')} title="대체 텍스트 (Alt+A)">대체</button>
      <button onClick={() => dialog('size')} title="크기·위치 속성 (Alt+P)">속성</button>
      <span className="divider" />
      <button
        onClick={() => {
          const hit = currentImage(editor)
          if (hit) window.dispatchEvent(new CustomEvent('jan-edit-image-in-paint', { detail: { src: hit.node.attrs.src, pos: hit.pos } }))
        }}
        title="그림판에서 주석 편집 (화살표·박스·텍스트)"
      >주석</button>
      <button onClick={() => editor.chain().focus().deleteSelection().run()} title="삭제">×</button>
    </div>
  )
}
