import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { REF_KINDS, REF_SHOWS, collectTargets, pageOfPos, refText } from '../lib/crossRef'
import type { RefKind, RefShow } from '../lib/crossRef'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 상호 참조 창 — 워드의 「상호 참조」 대화상자와 같은 자리.
 * 갈래(제목·표·그림…)를 고르고 대상을 고르면, 어떻게 보일지 미리 보여 준다.
 */
export function CrossRefPanel({ editor, onClose }: Props) {
  const targets = useMemo(() => collectTargets(editor), [editor])
  const [kind, setKind] = useState<RefKind>('heading')
  const [show, setShow] = useState<RefShow>('full')
  const [id, setId] = useState('')
  const [link, setLink] = useState(true)

  const shown = targets.filter((t) => t.kind === kind)
  const chosen = shown.find((t) => t.id === id) || shown[0]
  const preview = refText(chosen, show, chosen ? pageOfPos(editor, chosen.pos) : undefined)

  const insert = () => {
    if (!editor || !chosen) return
    editor.chain().focus().insertCrossRef({ kind, targetId: chosen.id, show, link }).run()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); insert() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  if (!editor) return null

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-xrefdlg" role="dialog" aria-label="상호 참조" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>상호 참조</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-xrefdlg-body">
          <div className="jan-xrefdlg-cols">
            <label className="jan-chartdlg-field">
              <span>참조 갈래</span>
              <select value={kind} onChange={(e) => { setKind(e.target.value as RefKind); setId('') }}>
                {REF_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label} ({targets.filter((t) => t.kind === k.key).length})</option>
                ))}
              </select>
            </label>
            <label className="jan-chartdlg-field">
              <span>보일 내용</span>
              <select value={show} onChange={(e) => setShow(e.target.value as RefShow)}>
                {REF_SHOWS.map((s) => <option key={s.key} value={s.key}>{s.label} — {s.hint}</option>)}
              </select>
            </label>
          </div>

          <div className="jan-xrefdlg-list" role="listbox" aria-label="참조할 대상">
            {shown.length === 0 && <p className="jan-xrefdlg-empty">이 갈래로 참조할 것이 문서에 아직 없다.</p>}
            {shown.map((t) => (
              <button
                key={t.id}
                role="option"
                aria-selected={chosen?.id === t.id}
                className={chosen?.id === t.id ? 'is-active' : ''}
                onClick={() => setId(t.id)}
                onDoubleClick={insert}
              >{t.label}</button>
            ))}
          </div>

          <label className="jan-chartdlg-check">
            <input type="checkbox" checked={link} onChange={(e) => setLink(e.target.checked)} />
            <span>누르면 그 자리로 가기 (하이퍼링크처럼)</span>
          </label>

          <p className="jan-xrefdlg-preview">들어갈 글: <strong>{preview}</strong></p>
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">번호가 밀리면 참조도 스스로 바뀐다</span>
          <button onClick={onClose}>취소</button>
          <button className="jan-primary" onClick={insert} disabled={!chosen}>넣기</button>
        </div>
      </div>
    </div>
  )
}
