import { listPostits, updatePostit, type Postit } from './justpin'
import { flash } from './flash'

/**
 * 떠 있는 포스트잇 — 브라우저 껍데기(주소창·탭·메뉴) 없이 메모지만 보이는 작은 창.
 *
 * 왜 이렇게 하나: `window.open` 으로 띄운 창에는 브라우저가 주소 줄을 붙인다.
 * 웹 페이지가 그 줄을 없앨 수는 없다 — 어디서 온 창인지 감추면 속임수에 쓰이기 때문이다.
 * 다만 「문서 그림 속 그림」(Document Picture-in-Picture) 창은 껍데기가 없고 늘 위에 뜬다.
 * 원래 영상 통화·재생기를 위해 만든 길인데, 포스트잇에 딱 맞는다.
 *
 * 이 창은 문서마다 하나만 열 수 있다 — 그래서 「한 장씩 여러 창」 이 아니라
 * 「한 창에 여러 장을 쌓는 보드」 로 만들었다. 새로 열면 그 장이 맨 위로 온다.
 *
 * 안 되는 브라우저(사파리·파이어폭스)에서는 예전처럼 작은 팝업으로 띄운다.
 */

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']

interface PipApi {
  requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>
  window?: Window | null
}

function pipApi(): PipApi | null {
  const api = (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture
  return api && typeof api.requestWindow === 'function' ? api : null
}

export function floatSupported(): boolean {
  return !!pipApi()
}

let floatWin: Window | null = null
/** 보드에 올려 둔 포스트잇 (맨 앞이 가장 최근) */
let shown: string[] = []

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
}

const STYLE = `
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #efe7d8; font-family: "Malgun Gothic", system-ui, sans-serif; }
  body { display: flex; flex-direction: column; gap: 6px; padding: 6px; overflow-y: auto; }
  .head { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b6255; flex: none; }
  .head strong { font-size: 12px; color: #4a4238; }
  .head .sp { flex: 1; }
  .note { border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.18); padding: 6px 8px 8px; flex: none; }
  .note textarea {
    width: 100%; min-height: 84px; border: 0; background: transparent; resize: vertical;
    font: 14px/1.55 inherit; color: #2b2b2b; outline: none; padding: 0;
  }
  .row { display: flex; align-items: center; gap: 3px; margin-top: 4px; }
  .row .sp { flex: 1; }
  .dot { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.18); cursor: pointer; padding: 0; }
  .dot.on { outline: 2px solid rgba(0,0,0,0.45); outline-offset: 1px; }
  .x { border: 0; background: rgba(0,0,0,0.08); border-radius: 5px; cursor: pointer; font-size: 11px; padding: 2px 7px; color: #333; }
  .x:hover { background: rgba(0,0,0,0.16); }
  .empty { font-size: 12px; color: #6b6255; padding: 10px 4px; }
`

/**
 * 보드를 다시 그린다 — 글을 쓰고 있는 칸은 건드리지 않는다.
 * 끼워 넣는 값(글·색·id)은 모두 esc() 로 감싼다. 포스트잇 글은 사용자가 적은 것이고
 * localStorage 를 손으로 고칠 수도 있어, 그대로 넣으면 남의 코드가 이 창에서 돈다.
 */
function render() {
  if (!floatWin || floatWin.closed) return
  const doc = floatWin.document
  const all = listPostits()
  const items = shown.map((id) => all.find((p) => p.id === id)).filter((p): p is Postit => !!p)
  shown = items.map((p) => p.id)

  const focusedId = (doc.activeElement as HTMLElement | null)?.closest?.('.note')?.getAttribute('data-id') || ''
  const caret = focusedId ? (doc.activeElement as HTMLTextAreaElement).selectionStart : 0

  doc.body.innerHTML = `
    <div class="head"><strong>포스트잇</strong><span class="sp"></span><span>${items.length}장 · 늘 위에</span></div>
    ${items.length === 0 ? '<div class="empty">보드가 비었다. 목록에서 「열기」 를 누른다.</div>' : ''}
    ${items.map((p) => `
      <div class="note" data-id="${esc(p.id)}" style="background:${esc(p.color)}">
        <textarea aria-label="포스트잇 내용" placeholder="짧은 메모...">${esc(p.text)}</textarea>
        <div class="row">
          ${COLORS.map((c) => `<button class="dot${c === p.color ? ' on' : ''}" data-color="${c}" style="background:${c}" title="${c}" aria-label="색 ${c}"></button>`).join('')}
          <span class="sp"></span>
          <button class="x" data-close="1">치우기</button>
        </div>
      </div>`).join('')}
  `

  doc.querySelectorAll<HTMLTextAreaElement>('.note textarea').forEach((ta) => {
    const id = ta.closest('.note')?.getAttribute('data-id') || ''
    ta.addEventListener('input', () => {
      updatePostit(id, { text: ta.value })
      window.dispatchEvent(new Event('jan-postit-changed'))
    })
  })
  doc.querySelectorAll<HTMLButtonElement>('.dot').forEach((dot) => {
    const note = dot.closest('.note') as HTMLElement | null
    dot.addEventListener('click', () => {
      const id = note?.getAttribute('data-id') || ''
      updatePostit(id, { color: dot.dataset.color || '#FFEB3B' })
      window.dispatchEvent(new Event('jan-postit-changed'))
      render()
    })
  })
  doc.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.note')?.getAttribute('data-id') || ''
      shown = shown.filter((x) => x !== id)
      render()
    })
  })

  /* 쓰던 칸으로 초점을 돌려 준다 (다시 그렸다고 커서가 튀면 글을 못 쓴다) */
  if (focusedId) {
    const back = doc.querySelector<HTMLTextAreaElement>(`.note[data-id="${focusedId}"] textarea`)
    if (back) {
      back.focus()
      try { back.setSelectionRange(caret, caret) } catch { /* 자리 못 잡아도 초점은 살린다 */ }
    }
  }
}

/** 껍데기 없는 창을 띄운다 (없으면 만든다) */
async function ensureWindow(): Promise<Window | null> {
  if (floatWin && !floatWin.closed) return floatWin
  const api = pipApi()
  if (!api) return null
  try {
    floatWin = await api.requestWindow({ width: 300, height: 360 })
  } catch {
    return null
  }
  const style = floatWin.document.createElement('style')
  style.textContent = STYLE
  floatWin.document.head.appendChild(style)
  floatWin.addEventListener('pagehide', () => { floatWin = null; shown = [] })
  return floatWin
}

/** 이 포스트잇을 떠 있는 보드에 올린다. 못 띄우면 false */
export async function floatPostit(p: Postit): Promise<boolean> {
  const win = await ensureWindow()
  if (!win) return false
  shown = [p.id, ...shown.filter((id) => id !== p.id)]
  render()
  win.focus?.()
  return true
}

/** 목록에 있는 것을 모두 보드에 올린다 */
export async function floatAll(): Promise<boolean> {
  const all = listPostits()
  if (!all.length) { flash('띄울 포스트잇이 없다'); return false }
  const win = await ensureWindow()
  if (!win) return false
  shown = all.map((p) => p.id)
  render()
  win.focus?.()
  return true
}

/** 목록 쪽에서 글·색을 고쳤을 때 보드도 맞춘다 */
export function refreshFloat(): void {
  if (floatWin && !floatWin.closed) render()
}

export function floatOpen(): boolean {
  return !!floatWin && !floatWin.closed
}
