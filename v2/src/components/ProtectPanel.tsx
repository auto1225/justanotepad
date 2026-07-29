import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { PROTECT_MODES, currentProtect, pinMatches, pinPrint, saveProtect } from '../lib/docProtect'
import type { ProtectMode } from '../lib/docProtect'
import { setTracking } from '../lib/trackChanges'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 편집 제한 — 워드 「검토 › 편집 제한」 + 「작성자 차단」.
 *
 * 지금 걸린 제한이 있으면 먼저 암호를 물어 푼다. 암호는 지문만 남기므로
 * 잊으면 되돌릴 수 없다 — 창에서 그렇게 미리 알려 준다.
 */
export function ProtectPanel({ editor, onClose }: Props) {
  const now = currentProtect()
  const locked = now.mode !== 'off' || now.blockOthers
  const [unlocked, setUnlocked] = useState(!locked || !now.pin)
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<ProtectMode>(now.mode)
  const [blockOthers, setBlockOthers] = useState(now.blockOthers)
  const [newPin, setNewPin] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!editor) return null

  const unlock = async () => {
    if (await pinMatches(pin)) { setUnlocked(true); flash('제한을 풀었다 — 이제 고칠 수 있다') }
    else flash('암호가 맞지 않는다')
  }

  const apply = async () => {
    const print = newPin ? await pinPrint(newPin) : (mode === 'off' && !blockOthers ? '' : now.pin)
    saveProtect({ mode, blockOthers, pin: print })
    /* 「고치면 표시 남기기」 는 추적이 켜져 있어야 뜻이 있다 */
    if (mode === 'track') setTracking(editor, true)
    flash(mode === 'off' && !blockOthers ? '제한을 없앴다' : '편집 제한을 걸었다')
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-protdlg" role="dialog" aria-label="편집 제한" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>편집 제한</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-protdlg-body">
          {!unlocked ? (
            <div className="jan-protdlg-lock">
              <p>이 문서에는 제한이 걸려 있다. 풀려면 암호를 적는다.</p>
              <label className="jan-chartdlg-field">
                <span>암호</span>
                <input type="password" value={pin} aria-label="암호" onChange={(e) => setPin(e.target.value)} />
              </label>
              <button className="jan-primary" onClick={() => void unlock()}>풀기</button>
            </div>
          ) : (
            <>
              <fieldset className="jan-protdlg-modes">
                <legend>손댈 수 있는 범위</legend>
                {PROTECT_MODES.map((m) => (
                  <label key={m.key} className={mode === m.key ? 'is-active' : ''}>
                    <input
                      type="radio"
                      name="jan-protect-mode"
                      checked={mode === m.key}
                      onChange={() => setMode(m.key)}
                      aria-label={m.label}
                    />
                    <strong>{m.label}</strong>
                    <span>{m.hint}</span>
                  </label>
                ))}
              </fieldset>

              <label className="jan-protdlg-check">
                <input
                  type="checkbox"
                  checked={blockOthers}
                  aria-label="남이 손댄 자리 잠그기"
                  onChange={(e) => setBlockOthers(e.target.checked)}
                />
                <span>
                  <strong>남이 손댄 자리 잠그기</strong>
                  <em>다른 이름으로 넣은 글과 메모가 있는 자리는 못 지운다 (워드의 작성자 차단)</em>
                </span>
              </label>

              <label className="jan-chartdlg-field">
                <span>풀 때 물어볼 암호 (비우면 그냥 풀린다)</span>
                <input
                  type="password"
                  value={newPin}
                  aria-label="새 암호"
                  placeholder={now.pin ? '지금 암호를 그대로 둔다' : '비워 두면 암호 없이'}
                  onChange={(e) => setNewPin(e.target.value)}
                />
              </label>
              <p className="jan-chartdlg-hint">
                암호는 지문만 남기므로 잊으면 되돌릴 수 없다. 내용을 정말 감춰야 한다면 「잠금(암호화)」 을 쓴다.
                제한은 이 기기의 이 메모에 걸린다.
              </p>
            </>
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">지금: {PROTECT_MODES.find((m) => m.key === now.mode)?.label}{now.blockOthers ? ' · 남의 자리 잠금' : ''}</span>
          <button onClick={onClose}>그만두기</button>
          <button className="jan-primary" disabled={!unlocked} onClick={() => void apply()}>이대로 걸기</button>
        </div>
      </div>
    </div>
  )
}
