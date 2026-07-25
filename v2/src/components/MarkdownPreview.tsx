import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { htmlToMd } from '../lib/markdownIO'
import { getSavableHtml } from '../extensions/PageDocument'

interface MarkdownPreviewProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 11 — Markdown 라이브 미리보기 (분할 화면 모달).
 * 좌측: TipTap HTML 렌더, 우측: 변환된 Markdown 텍스트.
 * 클립보드 복사 / .md 다운로드 버튼.
 */
export function MarkdownPreview({ editor, onClose }: MarkdownPreviewProps) {
  const html = editor ? getSavableHtml(editor) : ''
  const md = useMemo(() => htmlToMd(html), [html])
  if (!editor) return null

  function copyToClipboard() {
    navigator.clipboard.writeText(md).then(
      () => alert('Markdown 클립보드 복사됨'),
      () => alert('클립보드 복사 실패')
    )
  }
  function download() {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memo.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-mdpreview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>Markdown 미리보기</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body jan-mdpreview-body">
          <section className="jan-mdpreview-side">
            <div className="jan-mdpreview-label">렌더링 (HTML)</div>
            <div className="jan-mdpreview-html" dangerouslySetInnerHTML={{ __html: html }} />
          </section>
          <section className="jan-mdpreview-side">
            <div className="jan-mdpreview-label">
              Markdown ({md.length} 자)
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                <button onClick={copyToClipboard}>복사</button>
                <button onClick={download}>.md 다운로드</button>
              </span>
            </div>
            <pre className="jan-mdpreview-md">{md}</pre>
          </section>
        </div>
      </div>
    </div>
  )
}
