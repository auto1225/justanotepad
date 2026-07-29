import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  HANJA_MODES, hanjaText, hanjaToHangul, looksHanja, lookupHanja, syllableChoices,
} from '../lib/hanja'
import type { HanjaMode } from '../lib/hanja'
import { synonymsFor, THESAURUS_SIZE } from '../lib/thesaurus'
import { replaceSpot, wordAtCursor } from '../lib/selWord'
import { flash } from '../lib/flash'

export type SuggestMode = 'hanja' | 'synonym'

interface Props {
  editor: Editor | null
  mode: SuggestMode
  onClose: () => void
}

/**
 * 낱말 바꾸기 창 — 두 가지 일을 같은 모양으로 한다.
 *  · 한자 바꾸기 (한글의 F9) — 사전에 있으면 뜻과 함께, 없으면 한 음절씩 고른다.
 *  · 동의어 사전 (워드의 Shift+F7) — 대신 쓸 말과 반대말.
 *
 * 골라 둔 글이 없으면 커서가 짚은 낱말을 집는다.
 */
export function WordSuggestPanel({ editor, mode, onClose }: Props) {
  /* 창이 열릴 때 집은 낱말로 끝까지 간다 — 뒤에서 커서가 움직여도 다루던 낱말이 바뀌면 안 된다 */
  const [spot] = useState(() => wordAtCursor(editor))
  const [hMode, setHMode] = useState<HanjaMode>('hanja')

  const word = spot?.text || ''
  /* 「보고한다」 처럼 뒤가 붙은 말은 앞부분만 바꾸고 뒤는 한글로 남긴다 */
  const found = useMemo(() => (mode === 'hanja' ? lookupHanja(word) : { stem: word, tail: '', picks: [] }), [mode, word])
  const picks = found.picks
  const stem = found.stem
  const tail = found.tail
  const syllables = useMemo(
    () => (mode === 'hanja' && !picks.length ? syllableChoices(stem) : []),
    [mode, picks.length, stem],
  )
  const thes = useMemo(() => (mode === 'synonym' ? synonymsFor(word) : null), [mode, word])
  /* 음절마다 고른 한자 — 낱말이 정해져 있으니 길이도 처음에 정해진다 */
  const [syl, setSyl] = useState<string[]>(() => syllables.map(() => ''))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!editor) return null

  const put = (text: string) => {
    if (!spot) return
    if (replaceSpot(editor, spot, text)) flash(`「${word}」 → 「${text}」`)
    onClose()
  }

  const title = mode === 'hanja' ? '한자로 바꾸기' : '동의어 사전'

  /* 음절을 하나씩 고른 결과 — 아직 안 고른 자리는 한글을 그대로 둔다 */
  const composed = syllables.map((s, i) => syl[i] || s.sound).join('')

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-worddlg" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>{title}</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-modal-body jan-worddlg-body">
          <p className="jan-worddlg-word">
            <span>바꿀 말</span>
            <strong>{stem || '(커서를 낱말 안에 두거나 글을 고른다)'}</strong>
            {tail && <span>뒤의 「{tail}」 는 그대로 둔다</span>}
          </p>

          {mode === 'hanja' && (
            <>
              <div className="jan-design-row">
                <span>넣는 모양</span>
                {HANJA_MODES.map((m) => (
                  <label key={m.key} className="jan-worddlg-radio">
                    <input
                      type="radio"
                      name="jan-hanja-mode"
                      checked={hMode === m.key}
                      onChange={() => setHMode(m.key)}
                      aria-label={m.label}
                    />
                    <span>{m.label}</span>
                    <em>{m.hint}</em>
                  </label>
                ))}
              </div>

              {picks.length > 0 && (
                <ul className="jan-worddlg-list" aria-label="한자 후보">
                  {picks.map((p) => (
                    <li key={p.hanja}>
                      <button onClick={() => put(hanjaText(stem, p.hanja, hMode) + tail)}>
                        <strong>{p.hanja}</strong>
                        <span>{p.mean || '뜻풀이 없음'}</span>
                        <em>{hanjaText(stem, p.hanja, hMode) + tail}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {picks.length === 0 && syllables.length > 0 && (
                <div className="jan-worddlg-syl">
                  <p className="jan-chartdlg-hint">사전에 없는 말이다 — 한 자씩 고른다</p>
                  {syllables.map((s, i) => (
                    <div key={s.sound + i} className="jan-worddlg-sylrow">
                      <span className="jan-worddlg-sound">{s.sound}</span>
                      {s.picks.length === 0 ? <em>한자 없음</em> : s.picks.map((h) => (
                        <button
                          key={h}
                          className={syl[i] === h ? 'is-active' : ''}
                          aria-label={`${s.sound} → ${h}`}
                          onClick={() => setSyl((prev) => prev.map((v, j) => (j === i ? (v === h ? '' : h) : v)))}
                        >{h}</button>
                      ))}
                    </div>
                  ))}
                  <div className="jan-worddlg-foot">
                    <strong>{composed}</strong>
                    <button
                      className="jan-primary"
                      disabled={!syl.some(Boolean)}
                      onClick={() => put(hanjaText(stem, composed, hMode) + tail)}
                    >이대로 넣기</button>
                  </div>
                </div>
              )}

              {looksHanja(word) && (
                <div className="jan-worddlg-foot">
                  <span className="jan-chartdlg-hint">한자가 섞여 있다</span>
                  <button onClick={() => put(hanjaToHangul(word))}>한글로 되돌리기 — {hanjaToHangul(word)}</button>
                </div>
              )}

              {picks.length === 0 && syllables.every((s) => !s.picks.length) && !looksHanja(word) && (
                <p className="jan-worddlg-empty">이 말에 맞는 한자를 찾지 못했다.</p>
              )}
            </>
          )}

          {mode === 'synonym' && (
            thes ? (
              <>
                {thes.word !== word && (
                  <p className="jan-chartdlg-hint">사전에서 「{thes.word}」 로 찾았다</p>
                )}
                <p className="jan-worddlg-sub">대신 쓸 말</p>
                <ul className="jan-worddlg-list is-chips" aria-label="비슷한 말">
                  {thes.syn.map((s) => (
                    <li key={s}><button onClick={() => put(s)}>{s}</button></li>
                  ))}
                </ul>
                {thes.ant.length > 0 && (
                  <>
                    <p className="jan-worddlg-sub">반대말</p>
                    <ul className="jan-worddlg-list is-chips" aria-label="반대말">
                      {thes.ant.map((s) => (
                        <li key={s}><button onClick={() => put(s)}>{s}</button></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="jan-worddlg-empty">
                사전에 없는 말이다 (담긴 낱말 {THESAURUS_SIZE}개). 낱말만 골라 다시 눌러 본다.
              </p>
            )
          )}
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">
            {mode === 'hanja' ? '한글의 F9 자리 — 넣는 모양은 한자만 · 한글(한자) · 한자(한글)' : '워드의 Shift+F7 자리 — 누르면 그 자리에서 바뀐다'}
          </span>
          <button onClick={onClose}>그만두기</button>
        </div>
      </div>
    </div>
  )
}
