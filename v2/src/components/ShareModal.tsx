import { useEffect, useState } from 'react'
import { useMemosStore } from '../store/memosStore'
import { makeShareUrl } from '../lib/shareLink'

interface ShareModalProps {
  onClose: () => void
}

/**
 * Phase 11 — 단일 메모 공유 링크.
 * URL fragment 인코딩 — 백엔드 무의존, 단 URL 길이 제한.
 */
export function ShareModal({ onClose }: ShareModalProps) {
  const memo = useMemosStore((s) => s.current())
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!memo) return
    let alive = true // 메모를 바꾸면 이전 요청의 결과는 버린다
    makeShareUrl({ v: 1, title: memo.title, content: memo.content, createdAt: memo.createdAt }).then(
      (u) => { if (alive) { setUrl(u); setError('') } },
      (e) => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setUrl('') } }
    )
    return () => { alive = false }
  }, [memo])

  function copy() {
    if (!url) return
    navigator.clipboard.writeText(url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500) },
      () => alert('클립보드 복사 실패')
    )
  }

  if (!memo) return null

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>공유 링크</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            <b>{memo.title || '무제'}</b> 메모를 URL fragment 로 인코딩.
            받는 쪽은 같은 v2 앱 (justanotepad.com/v2/) 에서 열면 읽기 전용으로 표시됩니다.
            <br /><br />
            <small>· 검색엔진 노출 X (#fragment)<br />· URL 길이 제한 ~60KB<br />· 변경 시 새 링크 생성 필요</small>
          </div>
          {error && <div className="jan-ai-error">{error}</div>}
          {url && (
            <>
              <textarea
                readOnly
                value={url}
                className="jan-share-url"
                rows={5}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="jan-share-stats">{url.length.toLocaleString()} 자</div>
              <div className="jan-settings-actions">
                <button onClick={copy}>{copied ? '복사됨!' : '클립보드 복사'}</button>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <button>새 탭에서 열기</button>
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
