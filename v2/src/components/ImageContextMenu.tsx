import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  copyImageFormat, currentImage, downloadImage, fitImageToBody, flipImage, pasteImageFormat,
  resetImageFormat, resetImageSize, rotateImage, selectImage, setImageWrap, toggleImageLock,
} from '../lib/imageWord'

interface Props { editor: Editor | null }

interface MenuItem { label: string; hint?: string; run?: () => void; divider?: boolean }

/**
 * 그림 오른쪽 클릭 메뉴 — 워드에서 그림을 오른쪽 클릭하면 나오는 것과 같은 갈래.
 * Shift+F10 · 메뉴 키로도 열리고, 위아래 화살표로 골라 Enter 로 실행한다.
 */
export function ImageContextMenu({ editor }: Props) {
  const [at, setAt] = useState<{ x: number; y: number; keyboard: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editor) return
    const openAtCursor = () => {
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.from)
        setAt({ x: coords.left, y: coords.bottom + 4, keyboard: true })
      } catch { setAt(null) }
    }
    const onMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const img = target?.closest?.('.ProseMirror img') as HTMLElement | null
      const byKeyboard = !e.clientX && !e.clientY
      if (!img && !(byKeyboard && currentImage(editor))) return
      e.preventDefault()
      if (img) {
        // 오른쪽 클릭한 그림을 먼저 고른다 — 워드와 같은 순서
        const pos = editor.view.posAtDOM(img, 0)
        if (pos != null && pos >= 0) {
          editor.commands.setNodeSelection(pos)
        }
        setAt({ x: e.clientX, y: e.clientY, keyboard: false })
      } else {
        openAtCursor()
      }
    }
    const close = () => setAt(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAt(null); return }
      if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return
      if (!currentImage(editor)) return
      e.preventDefault()
      selectImage(editor)
      openAtCursor()
    }
    document.addEventListener('contextmenu', onMenu)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('contextmenu', onMenu)
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [editor])

  if (!editor || !at) return null

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const buttons = [...(menuRef.current?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(index + 1) % buttons.length].focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(index - 1 + buttons.length) % buttons.length].focus() }
    else if (e.key === 'Home') { e.preventDefault(); buttons[0].focus() }
    else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1].focus() }
    else if (e.key === 'Escape') { e.preventDefault(); setAt(null); editor.commands.focus() }
  }

  const dialog = (tab: string) => window.dispatchEvent(new CustomEvent('jan-image-dialog', { detail: { tab } }))
  const hit = currentImage(editor)

  const items: MenuItem[] = [
    { label: '잘라내기', hint: 'Ctrl+X', run: () => { document.execCommand('cut') } },
    { label: '복사', hint: 'Ctrl+C', run: () => { document.execCommand('copy') } },
    { label: '', divider: true },
    { label: '그림 바꾸기...', run: () => window.dispatchEvent(new CustomEvent('jan-image-replace')) },
    { label: '그림으로 저장...', run: () => { downloadImage(editor) } },
    { label: '', divider: true },
    { label: '자르기', hint: '손잡이로', run: () => window.dispatchEvent(new Event('jan-image-crop-mode')) },
    { label: '크기 및 위치...', hint: 'Alt+P', run: () => dialog('size') },
    { label: '텍스트 배치', hint: 'Alt+W', run: () => dialog('layout') },
    { label: '', divider: true },
    { label: '오른쪽으로 90° 회전', hint: 'Alt+R', run: () => { rotateImage(editor, 90) } },
    { label: '좌우 대칭', hint: 'Alt+H', run: () => { flipImage(editor, 'h') } },
    { label: '상하 대칭', hint: 'Alt+V', run: () => { flipImage(editor, 'v') } },
    { label: '', divider: true },
    { label: '글자처럼 취급', run: () => { setImageWrap(editor, 'inline', '배치: 글자처럼 취급') } },
    { label: '텍스트 뒤로 보내기', run: () => { setImageWrap(editor, 'behind', '배치: 텍스트 뒤') } },
    { label: '텍스트 앞으로 가져오기', run: () => { setImageWrap(editor, 'front', '배치: 텍스트 앞') } },
    { label: '', divider: true },
    { label: '캡션 넣기...', hint: 'Alt+C', run: () => dialog('caption') },
    { label: '대체 텍스트 편집...', hint: 'Alt+A', run: () => dialog('alt') },
    { label: '색 보정...', hint: 'Alt+T', run: () => dialog('adjust') },
    { label: '', divider: true },
    { label: '그림 서식 복사', hint: 'Alt+B', run: () => { copyImageFormat(editor) } },
    { label: '그림 서식 붙이기', hint: 'Alt+Shift+B', run: () => { pasteImageFormat(editor) } },
    { label: '그림 원래대로', hint: 'Alt+Z', run: () => { resetImageFormat(editor) } },
    { label: '원래 크기로', hint: 'Alt+0', run: () => { resetImageSize(editor) } },
    { label: '본문 너비에 맞춤', hint: 'Alt+F', run: () => { fitImageToBody(editor) } },
    { label: hit?.node.attrs.locked ? '개체 보호 풀기' : '개체 보호', hint: 'Alt+L', run: () => { toggleImageLock(editor) } },
    { label: '', divider: true },
    { label: '그림 삭제', hint: 'Del', run: () => editor.chain().focus().deleteSelection().run() },
  ]

  const W = 220
  const H = Math.min(items.length * 27 + 12, window.innerHeight - 16)
  const left = Math.min(at.x, window.innerWidth - W - 8)
  const top = Math.min(at.y, Math.max(8, window.innerHeight - H - 8))

  return (
    <div
      ref={(el) => {
        menuRef.current = el
        if (el && at.keyboard) (el.querySelector('button') as HTMLButtonElement | null)?.focus()
      }}
      className="jan-table-ctx jan-img-ctx"
      role="menu"
      style={{ left, top, width: W }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={'d' + i} className="jan-table-ctx-div" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => { item.run?.(); setAt(null) }}
          >
            <span>{item.label}</span>
            {item.hint && <small>{item.hint}</small>}
          </button>
        )
      )}
    </div>
  )
}
