import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { countReport } from '../lib/countReport'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 단어 개수 — 워드 「검토 › 단어 개수」.
 * 워드가 세는 것에 우리말 문서에서 자주 묻는 두 가지를 보탰다:
 * 공백 없는 글자 수(지원서가 요구하는 그 숫자)와 200자 원고지 매수.
 */
export function CountPanel({ editor, onClose }: Props) {
  /* 처음 셈은 열릴 때 한 번, 그 뒤로는 문서나 고른 글이 바뀔 때만 다시 센다 */
  const [r, setR] = useState(() => countReport(editor))

  useEffect(() => {
    if (!editor) return
    const recount = () => setR(countReport(editor))
    editor.on('update', recount)
    editor.on('selectionUpdate', recount)
    return () => { editor.off('update', recount); editor.off('selectionUpdate', recount) }
  }, [editor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!editor) return null

  const rows: [string, string][] = [
    ['쪽', String(r.pages)],
    ['단어', r.words.toLocaleString()],
    ['글자 (공백 포함)', r.charsWithSpaces.toLocaleString()],
    ['글자 (공백 없이)', r.charsNoSpaces.toLocaleString()],
    ['문단', String(r.paragraphs)],
    ['줄', String(r.lines)],
    ['원고지 (200자)', r.manuscript + '장'],
    ['표 · 그림 · 각주', `${r.tables} · ${r.images} · ${r.footnotes}`],
  ]

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-countdlg" role="dialog" aria-label="단어 개수" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>단어 개수</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body">
          <p className="jan-countdlg-scope">{r.selectionOnly ? '고른 글만 셈' : '문서 전체를 셈'}</p>
          <table className="jan-countdlg-table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">글을 고르면 그 부분만 센다 · 표와 각주까지 함께 센다</span>
          <button className="jan-primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
