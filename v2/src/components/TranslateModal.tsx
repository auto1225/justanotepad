import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { runAi, aiConfigured } from '../lib/aiApi'

interface TranslateModalProps {
  editor: Editor | null
  onClose: () => void
}

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文 (간체)' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
]

/**
 * Phase 16 — 메모 전체 또는 선택 영역 → 다국어 번역.
 * AI 사용. 결과를 새 메모로 또는 본문 교체.
 */
export function TranslateModal({ editor, onClose }: TranslateModalProps) {
  const [target, setTarget] = useState('en')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  if (!editor) return null

  const sel = editor.state.selection
  const hasSel = !sel.empty
  const text = hasSel
    ? editor.state.doc.textBetween(sel.from, sel.to, '\n')
    : editor.state.doc.textContent

  async function translate() {
    if (!aiConfigured()) {
      setError('설정에서 AI 키 또는 프록시를 활성화하세요.')
      return
    }
    if (!text.trim()) return
    setBusy(true); setError(''); setResult('')
    const lang = LANGS.find((l) => l.code === target)?.label || target
    const prompt = `Translate the following text to ${lang}. Preserve paragraph breaks and formatting. Output only the translation, no preamble.\n\n${text}`
    try {
      const r = await runAi('raw', prompt)
      if (r.ok && r.text) setResult(r.text)
      else setError(r.error || 'AI 응답 없음')
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  function insertAfter() {
    if (!editor || !result) return
    const label = LANGS.find((l) => l.code === target)?.label || target
    const html = `<p>--- ${escapeHtml(label)} ---</p><p>${escapeHtml(result).replace(/\n/g, '<br>')}</p>`
    editor.chain().focus().insertContentAt(sel.to, html).run()
    onClose()
  }
  function replace() {
    if (!editor || !result) return
    if (hasSel) {
      editor.chain().focus().deleteSelection().insertContent(escapeHtml(result).replace(/\n/g, '<br>')).run()
    } else {
      editor.commands.setContent(`<p>${escapeHtml(result).replace(/\n/g, '</p><p>')}</p>`)
    }
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-translate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>다국어 번역</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            {hasSel ? `선택 영역 ${text.length}자` : `전체 ${text.length}자`}
          </div>
          <div className="jan-settings-row">
            <label>대상 언어:</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="jan-settings-actions">
            <button onClick={translate} disabled={busy || !text.trim()} className="primary" style={{ background: '#D97757', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6 }}>
              {busy ? '번역 중...' : '번역'}
            </button>
          </div>
          {error && <div className="jan-ai-error">{error}</div>}
          {result && (
            <>
              <textarea
                value={result}
                onChange={(e) => setResult(e.target.value)}
                rows={12}
                style={{ width: '100%', boxSizing: 'border-box', padding: 8, border: '1px solid #ccc', borderRadius: 4, fontFamily: 'inherit', fontSize: 13 }}
              />
              <div className="jan-settings-actions">
                <button onClick={insertAfter}>아래에 추가</button>
                <button onClick={replace}>본문 교체</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
