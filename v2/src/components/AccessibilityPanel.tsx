import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { a11ySummary, checkAccessibility, fixIssue, gotoIssue } from '../lib/accessibility'
import type { A11yIssue } from '../lib/accessibility'
import { askText } from '../lib/promptModal'

interface Props {
  editor: Editor | null
  onClose: () => void
}

const LEVEL_LABEL: Record<string, string> = { error: '고쳐야 함', warn: '살펴볼 것', info: '알아 둘 것' }

/**
 * 접근성 검사 — 워드 「검토 › 접근성 검사」.
 *
 * 찾은 것마다 「그 자리로」 와 「고치기」 를 둔다. 그림 설명·표 머리글처럼
 * 우리가 대신 고칠 수 있는 것은 여기서 바로 고쳐 준다.
 */
export function AccessibilityPanel({ editor, onClose }: Props) {
  const [issues, setIssues] = useState<A11yIssue[]>([])

  const scan = useCallback(() => { setIssues(checkAccessibility(editor)) }, [editor])

  useEffect(() => {
    const t = window.requestAnimationFrame(scan)
    return () => window.cancelAnimationFrame(t)
  }, [scan])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!editor) return null

  const fix = async (issue: A11yIssue) => {
    if (issue.fix === 'alt') {
      const alt = await askText('이 그림을 무엇이라 읽어 줄까요? (한 줄로)', '')
      if (alt === null) return
      fixIssue(editor, issue, alt)
    } else if (issue.fix === 'caption') {
      const text = await askText('캡션 — 이 개체가 무엇을 보여 주는지 한 줄로', '')
      if (text === null) return
      fixIssue(editor, issue, text)
    } else {
      fixIssue(editor, issue)
    }
    scan()
  }

  const counts = {
    error: issues.filter((i) => i.level === 'error').length,
    warn: issues.filter((i) => i.level === 'warn').length,
    info: issues.filter((i) => i.level === 'info').length,
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-a11ydlg" role="dialog" aria-label="접근성 검사" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>접근성 검사</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-a11ydlg-sum">
          <span className="is-error">고쳐야 함 {counts.error}</span>
          <span className="is-warn">살펴볼 것 {counts.warn}</span>
          <span className="is-info">알아 둘 것 {counts.info}</span>
          <button onClick={scan}>다시 검사</button>
        </div>

        <div className="jan-modal-body jan-a11ydlg-body">
          {issues.length === 0 ? (
            <p className="jan-a11ydlg-clean">이 문서는 낭독기로 읽어도 막히는 데가 없다. 잘 만들었다.</p>
          ) : (
            <ul className="jan-a11ydlg-list">
              {issues.map((issue, i) => (
                <li key={i} className={'jan-a11ydlg-row is-' + issue.level}>
                  <div>
                    <strong>{issue.title}</strong>
                    <span className="jan-a11ydlg-level">{LEVEL_LABEL[issue.level]}</span>
                    <p>{issue.detail}</p>
                  </div>
                  <div className="jan-a11ydlg-acts">
                    {issue.pos != null && (
                      <button onClick={() => { gotoIssue(editor, issue); }} aria-label={`${issue.title} — 그 자리로`}>그 자리로</button>
                    )}
                    {issue.fix !== 'none' && (
                      <button className="jan-primary" onClick={() => void fix(issue)} aria-label={`${issue.title} — 고치기`}>
                        {issue.fix === 'alt' ? '설명 넣기' : issue.fix === 'header' ? '머리글로' : '캡션 넣기'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">{a11ySummary(issues)} · 화면 낭독기·큰 글씨로 읽는 사람을 기준으로 본다</span>
          <button className="jan-primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
