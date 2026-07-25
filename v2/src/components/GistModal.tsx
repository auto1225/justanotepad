import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { createGistFromMemo } from '../lib/gistExport'
import { useMemosStore } from '../store/memosStore'
import { getSavableHtml } from '../extensions/PageDocument'

interface GistModalProps {
  editor: Editor | null
  onClose: () => void
}

const TOKEN_KEY = 'jan-v2-github-token'

export function GistModal({ editor, onClose }: GistModalProps) {
  const memo = useMemosStore((s) => s.current())
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ url?: string; rawUrl?: string; error?: string } | null>(null)

  async function go() {
    if (!editor || !memo) return
    if (!token.trim()) { setResult({ error: 'GitHub PAT 입력 필요 (gist scope)' }); return }
    setBusy(true); setResult(null)
    try {
      const r = await createGistFromMemo(token.trim(), isPublic, memo.title, getSavableHtml(editor))
      // 성공한 토큰만 저장 — 오타/무효 토큰이 영구 저장되지 않게
      if (r.ok) localStorage.setItem(TOKEN_KEY, token.trim())
      setResult(r.ok ? { url: r.url, rawUrl: r.rawUrl } : { error: r.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-gist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>GitHub Gist 내보내기</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            현재 메모를 Markdown 으로 변환해 Gist 로 게시. PAT (gist scope) 필요. 토큰은 localStorage 에만 저장.
            <br />
            <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" style={{ color: '#D97757' }}>
              GitHub PAT 만들기 →
            </a>
          </div>
          <input
            type="password"
            placeholder="GitHub PAT (gist scope)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: 8, marginBottom: 8, border: '1px solid #ccc', borderRadius: 4 }}
          />
          <label style={{ display: 'block', marginBottom: 12 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {' '}공개 Gist (체크 안 하면 Secret)
          </label>
          <div className="jan-settings-actions">
            <button onClick={go} disabled={busy || !memo} className="primary" style={{ background: '#D97757', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6 }}>
              {busy ? '게시 중...' : 'Gist 만들기'}
            </button>
          </div>
          {result?.error && <div className="jan-ai-error">{result.error}</div>}
          {result?.url && (
            <div className="jan-settings-info" style={{ marginTop: 12 }}>
              <a href={result.url} target="_blank" rel="noopener noreferrer">Gist 페이지 ↗</a>
              <br />
              <a href={result.rawUrl} target="_blank" rel="noopener noreferrer">Raw Markdown ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
