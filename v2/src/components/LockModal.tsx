import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { encryptHtml, decryptHtml, isLocked } from '../lib/memoCrypto'
import { useMemosStore } from '../store/memosStore'
import { useVersionsStore } from '../store/versionsStore'

interface LockModalProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 12 — 메모 잠금/해제.
 * 잠그기: 현재 HTML → AES-GCM 암호화 → sentinel div 로 교체.
 * 해제: 비밀번호 입력 → 복호화 → editor 에 setContent.
 */
export function LockModal({ editor, onClose }: LockModalProps) {
  const updateCurrent = useMemosStore((s) => s.updateCurrent)
  const memo = useMemosStore((s) => s.current())
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!editor) return null

  const editorHtml = editor.getHTML()
  const storeContent = memo?.content || ''
  // 스토어 내용이 진실의 원천 — 에디터 스키마가 sentinel 을 벗겨낸 경우에도 잠금을 인식해야 한다
  const locked = isLocked(editorHtml) || isLocked(storeContent)
  const lockedSource = isLocked(editorHtml) ? editorHtml : storeContent

  async function lock() {
    if (locked) { setError('이미 잠긴 메모입니다. 먼저 해제하세요.'); return }
    if (pw.length < 4) { setError('비밀번호는 4자 이상.'); return }
    if (pw !== pw2) { setError('확인이 일치하지 않습니다.'); return }
    setBusy(true); setError('')
    try {
      const enc = await encryptHtml(editorHtml, pw)
      editor!.commands.setContent(enc)
      updateCurrent({ content: enc })
      // 잠금 전에 쌓인 평문 버전 스냅샷 제거 — 남겨두면 버전 패널/동기화로 평문이 새어나간다
      const lockedMemoId = useMemosStore.getState().currentId
      if (lockedMemoId) useVersionsStore.getState().removeAll(lockedMemoId)
      onClose()
    } catch (e) {
      setError('잠금 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  async function unlock() {
    if (!pw) { setError('비밀번호를 입력하세요.'); return }
    setBusy(true); setError('')
    try {
      const dec = await decryptHtml(lockedSource, pw)
      if (!dec) {
        setError('비밀번호가 틀렸거나 손상된 데이터입니다.')
        return
      }
      editor!.commands.setContent(dec)
      updateCurrent({ content: dec })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-lock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{locked ? '잠금 해제' : '메모 잠그기'}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            {locked
              ? '비밀번호를 입력해 메모를 해제합니다. AES-GCM 256bit + PBKDF2.'
              : '비밀번호로 이 메모를 암호화합니다. 비밀번호를 잃으면 복구 불가능 — 별도 보관 필수.'}
          </div>
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (locked) unlock()
                else if (pw === pw2) lock()
              }
            }}
          />
          {!locked && (
            <input
              type="password"
              placeholder="비밀번호 확인"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          )}
          {error && <div className="jan-ai-error">{error}</div>}
          <div className="jan-settings-actions">
            <button onClick={locked ? unlock : lock} disabled={busy}>
              {busy ? '처리 중...' : locked ? '해제' : '잠그기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
