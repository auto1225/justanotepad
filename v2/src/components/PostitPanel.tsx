import { useState, useEffect } from 'react'
import { listPostits, addPostit, removePostit, updatePostit, openPostitWindow, type Postit } from '../lib/justpin'
import { useDocStore } from '../store/docStore'
import { flash } from '../lib/flash'

interface PostitPanelProps {
  onClose: () => void
}

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']
const STORAGE_KEY = 'jan-v2-postits'

/**
 * Phase 5 — JustPin 포스트잇 매니저.
 * Top-bar 카드 그리드 + 새 포스트잇 + 클릭하면 별도 창에서 편집.
 * Storage 이벤트로 다른 창의 변경을 자동 반영.
 */
export function PostitPanel({ onClose }: PostitPanelProps) {
  const [items, setItems] = useState<Postit[]>(listPostits())
  const [text, setText] = useState('')
  const [color, setColor] = useState(COLORS[0])

  function refresh() {
    setItems(listPostits())
  }

  // 다른 창/탭에서 localStorage 변경 시 자동 새로고침
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    // 폴링도 추가 (같은 origin 새 창은 storage 이벤트 발화 안 할 수 있음)
    const t = setInterval(refresh, 2000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(t)
    }
  }, [])

  const editor = useDocStore((s) => s.editor)

  async function create() {
    if (!text.trim()) return
    const p = addPostit(text.trim(), color)
    setText('')
    refresh()
    /* 새 창이 막히면 아무 일도 없는 것처럼 보인다 — 목록에는 남았다고 알려 준다 */
    const opened = await openPostitWindow(p)
    flash(opened ? '포스트잇을 띄웠다' : '새 창이 막혔다 — 목록에 넣어 두었으니 「열기」 로 띄운다', 2600)
  }

  async function open(p: Postit) {
    const opened = await openPostitWindow(p)
    if (!opened) flash('새 창이 막혔다 — 브라우저에서 이 사이트의 팝업을 허용한다', 2600)
  }

  function del(id: string) {
    removePostit(id)
    refresh()
  }

  /* 카드에서 고친 글·색은 곧바로 저장한다 (창을 열지 않고도 손볼 수 있게) */
  function edit(id: string, patch: Partial<Postit>) {
    updatePostit(id, patch)
    refresh()
  }

  /** 포스트잇을 지금 문서로 옮긴다 — 「메모로 키우기」 */
  function toMemo(p: Postit) {
    if (!editor || editor.isDestroyed) { flash('열어 둔 문서가 없다'); return }
    const html = p.text.split(/\n{2,}/).map((para) =>
      `<p>${para.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('')
    editor.chain().focus().insertContent(html || '<p></p>').run()
    flash('쓰던 자리에 옮겼다')
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-postit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>JustPin 포스트잇</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-postit-create">
            <textarea
              placeholder="새 포스트잇 내용..."
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
                  title="색상 선택"
                />
              ))}
            </div>
            <button className="jan-postit-add" onClick={() => { void create() }}>새 포스트잇 (별도 창)</button>
            <p className="jan-postit-note">카드에서 글과 색을 바로 고칠 수 있다 · 「메모로」 는 쓰던 자리에 옮긴다</p>
          </div>

          <div className="jan-postit-grid">
            {items.length === 0 && <div className="jan-postit-empty">포스트잇이 없습니다.</div>}
            {items.map((p) => (
              <div key={p.id} className="jan-postit-card" style={{ background: p.color }}>
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
                  <button onClick={() => { void open(p) }}>열기</button>
                  <button onClick={() => toMemo(p)} disabled={!editor}>메모로</button>
                  <button onClick={() => del(p.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
