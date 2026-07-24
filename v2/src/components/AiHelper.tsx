import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { runAi, aiConfigured } from '../lib/aiApi'

interface AiHelperProps {
  editor: Editor | null
  onClose: () => void
}

type AiMode = 'summarize' | 'translate' | 'improve' | 'continue'

const MODE_LABELS: Record<AiMode, string> = {
  summarize: '요약',
  translate: '번역 (영문)',
  improve: '문장 다듬기',
  continue: '이어쓰기',
}

/**
 * Phase 5 — AI 도우미 (실 API 연결).
 * SettingsModal 에서 Anthropic 또는 OpenAI 키 입력 후 동작.
 * 키 미설정 시 안내 메시지.
 */
export function AiHelper({ editor, onClose }: AiHelperProps) {
  const [mode, setMode] = useState<AiMode>('summarize')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!editor) return null

  const selection = editor.state.selection
  const hasSelection = !selection.empty
  const inputText = hasSelection
    ? editor.state.doc.textBetween(selection.from, selection.to, ' ')
    : editor.state.doc.textContent

  async function run() {
    if (!inputText.trim()) {
      setError('대상 텍스트가 비었습니다')
      return
    }
    setLoading(true)
    setOutput('')
    setError('')
    try {
      const res = await runAi(mode, inputText)
      if (res.ok && res.text) {
        setOutput(res.text)
      } else {
        setError(res.error || '알 수 없는 오류')
      }
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  function applyToEditor() {
    if (!output || !editor) return
    if (hasSelection) {
      editor.chain().focus().insertContentAt(selection.to, aiOutputToHtml(output)).run()
    } else {
      editor.chain().focus().insertContent(aiOutputToHtml(output)).run()
    }
    onClose()
  }

  function replaceSelection() {
    if (!output || !editor || !hasSelection) return
    editor.chain().focus().deleteSelection().insertContent(aiOutputToHtml(output)).run()
    onClose()
  }

  const configured = aiConfigured()

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>AI 도우미</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          {!configured && (
            <div className="jan-ai-warn">
              AI 키가 설정되지 않았습니다. 설정 (Ctrl+,) 에서 Anthropic 또는 OpenAI 키 입력 후 사용하세요.
            </div>
          )}
          <div className="jan-ai-modes">
            {(Object.keys(MODE_LABELS) as AiMode[]).map((m) => (
              <button
                key={m}
                className={'jan-ai-mode' + (mode === m ? ' is-active' : '')}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <div className="jan-ai-input-info">
            {hasSelection
              ? `선택된 ${selection.to - selection.from}자에 대해 적용`
              : `문서 전체 (${inputText.length}자) 에 대해 적용`}
          </div>
          <button className="jan-ai-run" onClick={run} disabled={loading || !configured}>
            {loading ? '실행 중...' : `${MODE_LABELS[mode]} 실행`}
          </button>
          {error && <div className="jan-ai-error">오류: {error}</div>}
          {output && (
            <>
              <div className="jan-ai-output" style={{ whiteSpace: 'pre-wrap' }}>{output}</div>
              <div style={{display:'flex',gap:6}}><button className="jan-ai-apply" onClick={applyToEditor}>문서에 추가</button>{hasSelection && <button className="jan-ai-apply" onClick={replaceSelection} style={{background:'#5D4037'}}>선택 영역 교체</button>}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function aiOutputToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<p>' + esc.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
}
