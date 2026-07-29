import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  acceptAll, acceptChange, changeCount, listChanges, rejectAll, rejectChange,
} from '../lib/trackChanges'
import type { TrackRow } from '../lib/trackChanges'
import { gotoComment, listComments, removeComment, toggleCommentDone } from '../lib/commentField'
import type { CommentRow } from '../lib/commentField'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 검토 창 — 워드 「검토 › 검토 창」.
 *
 * 문서에 남은 고친 자리와 메모를 한 자리에 모아 놓고, 누르면 그 자리로 가서
 * 적용하거나 되돌린다. ↑↓ 로 옮겨 다니고 Enter 로 그 자리로 가며,
 * 목록 위 단추로 한꺼번에 적용·되돌리기도 된다.
 */
export function ReviewPane({ editor, onClose }: Props) {
  const [changes, setChanges] = useState<TrackRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])

  const scan = useCallback(() => {
    setChanges(listChanges(editor))
    setComments(listComments(editor))
  }, [editor])

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
  const live = editor

  const goto = (row: TrackRow) => {
    editor.chain().focus().setTextSelection({ from: row.from, to: row.to }).scrollIntoView().run()
  }

  function onKey(e: React.KeyboardEvent) {
    const buttons = [...document.querySelectorAll('.jan-revpane-row > button:first-child')] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[Math.min(buttons.length - 1, i + 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[Math.max(0, i - 1)]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); live.commands.focus() }
  }

  const n = changeCount(editor)
  const open = comments.filter((c) => !c.done).length

  return (
    <div className="jan-objpane jan-revpane" role="dialog" aria-label="검토 창" onKeyDown={onKey}>
      <div className="jan-objpane-head">
        <strong>검토</strong>
        <span className="jan-objpane-count">넣음 {n.ins} · 지움 {n.del} · 메모 {open}</span>
        <button onClick={onClose} aria-label="검토 창 닫기">닫기</button>
      </div>

      <div className="jan-revpane-bulk">
        <button onClick={() => { acceptAll(editor); scan() }} disabled={!changes.length}>모두 적용</button>
        <button onClick={() => { rejectAll(editor); scan() }} disabled={!changes.length}>모두 되돌림</button>
      </div>

      {changes.length === 0 && comments.length === 0 ? (
        <p className="jan-objpane-empty">고친 자리도 메모도 없다. 「변경 내용 추적」 을 켜고 글을 고치면 여기에 쌓인다.</p>
      ) : (
        <ul className="jan-objpane-list">
          {changes.map((row) => (
            <li key={`${row.kind}-${row.from}`} className={'jan-revpane-row is-' + row.kind}>
              <button onClick={() => goto(row)} title="이 자리로 간다">
                <span className="jan-revpane-kind">{row.kind === 'ins' ? '넣음' : '지움'}</span>
                <span className={row.kind === 'ins' ? 'jan-revpane-text is-ins' : 'jan-revpane-text is-del'}>
                  {row.text.slice(0, 40) || '(빈 글)'}
                </span>
                <span className="jan-cmtpane-meta">{row.author || '누군가'} · {row.at}</span>
              </button>
              <button onClick={() => { acceptChange(editor, row); scan() }} aria-label="이 변경 적용">적용</button>
              <button onClick={() => { rejectChange(editor, row); scan() }} aria-label="이 변경 되돌림">되돌림</button>
            </li>
          ))}
          {comments.map((row) => (
            <li key={row.id} className={row.done ? 'jan-revpane-row is-memo is-done' : 'jan-revpane-row is-memo'}>
              <button onClick={() => gotoComment(editor, row)} title="이 자리로 간다">
                <span className="jan-revpane-kind">메모</span>
                <span className="jan-revpane-text">{row.text.slice(0, 40)}</span>
                <span className="jan-cmtpane-meta">{row.author} · {row.at} — “{row.quote.slice(0, 16)}”</span>
              </button>
              <button onClick={() => { toggleCommentDone(editor, row); scan() }} aria-label={row.done ? '메모 다시 열기' : '메모 끝내기'}>
                {row.done ? '되열기' : '끝냄'}
              </button>
              <button onClick={() => { removeComment(editor, row); scan() }} aria-label="메모 지우기">×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="jan-objpane-hint">↑↓ 로 옮겨 다니고 Enter 로 그 자리로 · Alt+, / Alt+. 으로 앞뒤 변경</p>
    </div>
  )
}
