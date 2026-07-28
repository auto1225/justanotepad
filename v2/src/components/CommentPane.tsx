import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { gotoComment, listComments, removeComment, toggleCommentDone, updateComment } from '../lib/commentField'
import type { CommentRow } from '../lib/commentField'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 메모 목록 — 워드에서 문서 오른쪽에 뜨는 메모 말풍선 자리.
 * 눌러서 그 자리로 가고, 고치고, 끝내고, 지운다. 모두 키보드로도 된다.
 */
export function CommentPane({ editor, onClose }: Props) {
  const [rows, setRows] = useState<CommentRow[]>([])

  const scan = useCallback(() => { setRows(listComments(editor)) }, [editor])

  useEffect(() => {
    if (!editor) return
    const first = window.requestAnimationFrame(scan)
    editor.on('update', scan)
    editor.on('selectionUpdate', scan)
    return () => {
      window.cancelAnimationFrame(first)
      editor.off('update', scan)
      editor.off('selectionUpdate', scan)
    }
  }, [editor, scan])

  if (!editor) return null

  function onKey(e: React.KeyboardEvent) {
    const buttons = [...document.querySelectorAll('.jan-cmtpane-row > button:first-child')] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[Math.min(buttons.length - 1, i + 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[Math.max(0, i - 1)]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); editor?.commands.focus() }
  }

  const open = rows.filter((r) => !r.done).length

  return (
    <div className="jan-objpane jan-cmtpane" role="dialog" aria-label="메모 목록" onKeyDown={onKey}>
      <div className="jan-objpane-head">
        <strong>메모</strong>
        <span className="jan-objpane-count">{open}/{rows.length}</span>
        <button onClick={onClose} aria-label="메모 목록 닫기">닫기</button>
      </div>
      {rows.length === 0 ? (
        <p className="jan-objpane-empty">아직 메모가 없다. 글을 골라 Ctrl+Alt+M 을 누른다.</p>
      ) : (
        <ul className="jan-objpane-list">
          {rows.map((row) => (
            <li key={row.id} className={row.done ? 'jan-cmtpane-row is-done' : 'jan-cmtpane-row'}>
              <button onClick={() => gotoComment(editor, row)} title="이 자리로 간다">
                <span className="jan-cmtpane-quote">{row.quote.slice(0, 24)}</span>
                <span className="jan-cmtpane-text">{row.text}</span>
                <span className="jan-cmtpane-meta">{row.author} · {row.at}</span>
              </button>
              <button
                onClick={() => {
                  const next = window.prompt('메모 고치기', row.text)
                  if (next != null) { updateComment(editor, row.id, { text: next }); scan() }
                }}
                aria-label="메모 고치기"
              >고침</button>
              <button onClick={() => { toggleCommentDone(editor, row); scan() }} aria-label={row.done ? '메모 다시 열기' : '메모 끝내기'}>
                {row.done ? '되열기' : '끝냄'}
              </button>
              <button onClick={() => { removeComment(editor, row); scan() }} aria-label="메모 지우기">×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="jan-objpane-hint">↑↓ 로 옮겨 다니고 Enter 로 그 자리로 · Ctrl+Alt+M 으로 새 메모</p>
    </div>
  )
}
