import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { getSavableHtml } from '../extensions/PageDocument'
import { errText } from '../lib/errText'

interface LinkCheckModalProps {
  editor: Editor | null
  onClose: () => void
}

interface LinkStatus {
  url: string
  text: string
  status: 'pending' | 'ok' | 'broken' | 'cors'
  code?: number
  error?: string
}

/**
 * Phase 14 — 깨진 링크 검사.
 * 메모 안 모든 <a href> URL 추출 → HEAD/GET fetch (CORS no-cors 모드).
 * CORS 차단 사이트는 'cors' 상태 (실제 작동 여부는 알 수 없음).
 */
/** 본문에서 검사할 링크를 뽑아낸다 (같은 URL 은 한 번만) */
function collectLinks(editor: Editor | null): LinkStatus[] {
  if (!editor) return []
  const div = document.createElement('div')
  div.innerHTML = getSavableHtml(editor)
  const links: LinkStatus[] = []
  const seen = new Set<string>()
  div.querySelectorAll('a[href]').forEach((a) => {
    const href = (a as HTMLAnchorElement).href
    if (!href || href.startsWith('javascript:')) return
    if (seen.has(href)) return
    seen.add(href)
    links.push({ url: href, text: (a.textContent || '').slice(0, 50), status: 'pending' })
  })
  return links
}

export function LinkCheckModal({ editor, onClose }: LinkCheckModalProps) {
  // 모달은 열 때마다 새로 붙으므로 첫 렌더에 한 번 모아 두면 된다
  const [items, setItems] = useState<LinkStatus[]>(() => collectLinks(editor))
  const [busy, setBusy] = useState(false)

  async function check() {
    setBusy(true)
    const updated = [...items]
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i]
      try {
        // no-cors 모드 — opaque 응답이라 ok 검증 불가, 하지만 네트워크 도달 여부 확인
        const r = await fetch(item.url, { method: 'GET', mode: 'no-cors', redirect: 'follow' })
        // opaque = 도달함 (CORS 차단)
        if (r.type === 'opaque') {
          updated[i] = { ...item, status: 'cors' }
        } else if (r.ok) {
          updated[i] = { ...item, status: 'ok', code: r.status }
        } else {
          updated[i] = { ...item, status: 'broken', code: r.status }
        }
      } catch (e) {
        updated[i] = { ...item, status: 'broken', error: errText(e) || 'network' }
      }
      setItems([...updated])
    }
    setBusy(false)
  }

  const counts = {
    total: items.length,
    ok: items.filter((i) => i.status === 'ok').length,
    cors: items.filter((i) => i.status === 'cors').length,
    broken: items.filter((i) => i.status === 'broken').length,
    pending: items.filter((i) => i.status === 'pending').length,
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-linkcheck-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>링크 검사 ({counts.total})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            CORS 정책상 외부 서버 응답 코드를 직접 확인할 수 없는 경우 'cors' 로 표시 — 실제로는 작동할 수 있음.
          </div>
          <div className="jan-settings-actions">
            <button onClick={check} disabled={busy || counts.total === 0}>
              {busy ? '검사 중...' : '전체 검사'}
            </button>
            <span className="jan-settings-info" style={{ marginLeft: 8 }}>
              ✓ {counts.ok} · CORS {counts.cors} · ✗ {counts.broken} · 대기 {counts.pending}
            </span>
          </div>
          <ul className="jan-linkcheck-list">
            {items.length === 0 && <li className="jan-trash-empty">메모에 링크가 없습니다.</li>}
            {items.map((it, i) => (
              <li key={i} className={'jan-linkcheck-item is-' + it.status}>
                <span className="jan-linkcheck-status">
                  {it.status === 'ok' ? '✓' : it.status === 'broken' ? '✗' : it.status === 'cors' ? '?' : '⋯'}
                </span>
                <a href={it.url} target="_blank" rel="noopener noreferrer">
                  <div className="jan-linkcheck-text">{it.text || it.url}</div>
                  <div className="jan-linkcheck-url">{it.url}</div>
                </a>
                {it.code && <span className="jan-linkcheck-code">{it.code}</span>}
                {it.error && <span className="jan-linkcheck-err">{it.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
