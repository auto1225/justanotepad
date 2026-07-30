import { useState, useEffect, useCallback } from 'react'
import { listPostits, addPostit, removePostit, updatePostit, postitHtml, type Postit } from '../lib/justpin'
import { openAll, openOne, openedIds, standalone } from '../lib/postitWindow'
import { floatAll, floatSupported, refreshFloat } from '../lib/postitFloat'
import { useDocStore } from '../store/docStore'
import { flash } from '../lib/flash'

interface PostitPanelProps {
  onClose: () => void
}

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']
const STORAGE_KEY = 'jan-v2-postits'

/**
 * 포스트잇 목록 — 어디에 몇 장이 붙어 있는지 한눈에 보고, 띄우고 치운다.
 *
 * 포스트잇은 「여러 장이 각자 창에 떠 있고, 껐다 켜도 그 자리에 있는 것」 이다.
 *  · 「띄우기」 — 한 장이 자기 창에 뜬다 (창 안에서 굵게·기울임·밑줄·글자색·글머리를 쓴다)
 *  · 옮겨 둔 자리와 크기를 적어 두고, 앱을 다시 열면 그 자리에 되살린다
 *  · 「모아 보기」 — 브라우저 껍데기 없이 한 창에 쌓아 본다 (한 번에 한 창만 되는 길이다)
 */
export function PostitPanel({ onClose }: PostitPanelProps) {
  const [items, setItems] = useState<Postit[]>(listPostits())
  const [live, setLive] = useState<string[]>(openedIds())
  const [text, setText] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const editor = useDocStore((s) => s.editor)

  const refresh = useCallback(() => {
    setItems(listPostits())
    setLive(openedIds())
  }, [])

  // 다른 창·탭에서 고친 것도 비친다 (같은 탭에서 띄운 창은 storage 사건을 쏘지 않아 살펴보기도 함께)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('jan-postit-changed', refresh)
    const t = setInterval(refresh, 1500)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('jan-postit-changed', refresh)
      clearInterval(t)
    }
  }, [refresh])

  function create() {
    if (!text.trim()) return
    const p = addPostit(text.trim(), color)
    setText('')
    open(p)
  }

  /** 한 장을 자기 창에 띄운다 */
  function open(p: Postit) {
    if (openOne(p, refresh)) {
      refresh()
      /* 브라우저 탭에서는 얇은 주소 띠가 붙는다 — 어떻게 없애는지 함께 알려 준다 */
      flash(standalone() ? '포스트잇을 띄웠다' : '포스트잇을 띄웠다 — 앱으로 설치하면 주소 띠 없이 뜬다', 2600)
      return
    }
    flash('새 창이 막혔다 — 이 사이트의 팝업을 허용하면 각자 창으로 뜬다', 3200)
  }

  function del(id: string) {
    removePostit(id)
    refresh()
  }

  /* 카드에서 고친 글·색은 곧바로 저장한다 (창을 띄우지 않고도 손볼 수 있게) */
  function edit(id: string, patch: Partial<Postit>) {
    updatePostit(id, patch)
    refresh()
    refreshFloat()
  }

  /** 포스트잇을 지금 문서로 옮긴다 — 「메모로 키우기」 (서식도 함께 간다) */
  function toMemo(p: Postit) {
    if (!editor || editor.isDestroyed) { flash('열어 둔 문서가 없다'); return }
    editor.chain().focus().insertContent(postitHtml(p) || '<p></p>').run()
    flash('쓰던 자리에 옮겼다')
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-postit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>포스트잇</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-postit-create">
            <textarea
              placeholder="새 포스트잇 내용..."
              aria-label="새 포스트잇 내용"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
            <div className="jan-postit-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={'jan-postit-color' + (c === color ? ' is-active' : '')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={'새 포스트잇 색 ' + c}
                  title="색 고르기"
                />
              ))}
            </div>
            <div className="jan-postit-addrow">
              <button className="jan-postit-add" onClick={create}>새 포스트잇 띄우기</button>
              <button
                onClick={() => { const n = openAll(refresh); refresh(); flash(n ? `${n}장을 띄웠다` : '띄울 포스트잇이 없다') }}
                disabled={items.length === 0}
              >모두 띄우기</button>
              {floatSupported() && (
                <button
                  onClick={() => { void floatAll() }}
                  disabled={items.length === 0}
                  title="브라우저 껍데기 없이 한 창에 쌓아 본다 (한 번에 한 창)"
                >모아 보기 (껍데기 없음)</button>
              )}
            </div>
            <p className="jan-postit-note">
              한 장이 각자 창에 뜬다 — 창 안에서 굵게·기울임·밑줄·글자색·글머리 기호를 쓸 수 있다.
              옮겨 둔 자리와 크기를 적어 두어, 앱을 다시 열면 그 자리에 되살린다.
              {standalone() ? '' : ' 앱으로 설치하면 주소 띠 없이 뜬다.'}
            </p>
          </div>

          <div className="jan-postit-grid">
            {items.length === 0 && <div className="jan-postit-empty">포스트잇이 없습니다.</div>}
            {items.map((p) => (
              <div
                key={p.id}
                className={'jan-postit-card' + (live.includes(p.id) ? ' is-live' : '')}
                style={{ background: p.color }}
              >
                <textarea
                  value={p.text}
                  aria-label="포스트잇 내용"
                  onChange={(e) => edit(p.id, { text: e.target.value })}
                />
                <div className="jan-postit-colors">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={'jan-postit-color' + (c === p.color ? ' is-active' : '')}
                      style={{ background: c }}
                      aria-label={'색 바꾸기 ' + c}
                      onClick={() => edit(p.id, { color: c })}
                    />
                  ))}
                </div>
                <div className="jan-postit-actions">
                  <button onClick={() => open(p)}>{live.includes(p.id) ? '앞으로' : '띄우기'}</button>
                  <button onClick={() => toMemo(p)} disabled={!editor}>메모로</button>
                  <button onClick={() => del(p.id)}>삭제</button>
                </div>
                {live.includes(p.id) && <span className="jan-postit-live">떠 있음</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
