import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'

/**
 * 앱 스타일 입력 모달 — window.prompt 대체.
 * Promise 로 값(또는 취소 시 null)을 반환해 기존 prompt 호출부를 최소 변경으로 교체.
 *
 *   const url = await askText('이미지 URL:')
 *   if (url) ...
 */
interface AskOptions {
  title: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  okLabel?: string
}

let container: HTMLDivElement | null = null
let root: Root | null = null

function ensureRoot(): Root {
  if (!container) {
    container = document.createElement('div')
    container.id = 'jan-prompt-modal-root'
    document.body.appendChild(container)
    root = createRoot(container)
  }
  return root!
}

export function askText(title: string, defaultValue = '', opts: Partial<AskOptions> = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const r = ensureRoot()
    const close = (value: string | null) => {
      r.render(null)
      resolve(value)
    }
    r.render(<PromptModal title={title} defaultValue={defaultValue} {...opts} onClose={close} />)
  })
}

/** 앱 스타일 확인 모달 — window.confirm 대체. 확인 시 true, 취소/닫기 시 false */
export function askConfirm(title: string, detail = '', okLabel = '확인'): Promise<boolean> {
  return new Promise((resolve) => {
    const r = ensureRoot()
    const close = (ok: boolean) => {
      r.render(null)
      resolve(ok)
    }
    r.render(<ConfirmModal title={title} detail={detail} okLabel={okLabel} onClose={close} />)
  })
}

function ConfirmModal({ title, detail, okLabel, onClose }: { title: string; detail: string; okLabel: string; onClose: (ok: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { okRef.current?.focus() }, [])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(false) }
    else if (e.key === 'Enter') { e.preventDefault(); onClose(true) }
  }
  return (
    <div className="jan-modal-overlay" onClick={() => onClose(false)} onKeyDown={onKey} role="dialog" aria-modal="true" aria-label={title}>
      <div className="jan-modal jan-prompt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="jan-modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <button className="jan-modal-close" onClick={() => onClose(false)} aria-label="취소">닫기</button>
        </div>
        <div className="jan-modal-body" style={{ padding: 16 }}>
          {detail && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>{detail}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button onClick={() => onClose(false)} style={{ padding: '6px 14px' }}>취소</button>
            <button ref={okRef} onClick={() => onClose(true)} className="primary" style={{ padding: '6px 14px', background: '#D97757', color: '#fff', border: 0, borderRadius: 6 }}>{okLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromptModal({ title, defaultValue = '', placeholder, multiline, okLabel = '확인', onClose }: AskOptions & { onClose: (v: string | null) => void }) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (inputRef.current && 'select' in inputRef.current) inputRef.current.select()
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(null) }
    else if (e.key === 'Enter' && !multiline) { e.preventDefault(); onClose(value) }
    else if (e.key === 'Enter' && multiline && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onClose(value) }
  }

  return (
    <div className="jan-modal-overlay" onClick={() => onClose(null)} role="dialog" aria-modal="true" aria-label={title}>
      <div className="jan-modal jan-prompt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="jan-modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <button className="jan-modal-close" onClick={() => onClose(null)} aria-label="취소">닫기</button>
        </div>
        <div className="jan-modal-body" style={{ padding: 16 }}>
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', padding: 8, border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', fontSize: 13 }}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14 }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
            <button onClick={() => onClose(null)} style={{ padding: '6px 14px' }}>취소</button>
            <button onClick={() => onClose(value)} className="primary" style={{ padding: '6px 14px', background: '#D97757', color: '#fff', border: 0, borderRadius: 6 }}>{okLabel}</button>
          </div>
          {multiline && <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Ctrl+Enter 로 확인</div>}
        </div>
      </div>
    </div>
  )
}
