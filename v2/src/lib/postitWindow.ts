import { cleanPostitHtml, listPostits, postitHtml, reopenList, updatePostit, type Postit } from './justpin'
import { flash } from './flash'

/**
 * 포스트잇 창 — 한 장이 각자 자기 창에 뜬다.
 *
 * 포스트잇의 본질은 「여러 장이 각자 화면에 붙어 있고, 껐다 켜도 그 자리에 있는 것」 이다.
 * 그래서 이렇게 만들었다:
 *   · 한 장에 창 하나 (window.open · 창 이름을 id 로 두어 두 번 열리지 않는다)
 *   · 창 안에 작은 편집기 — 굵게·기울임·밑줄·글자색·글머리 기호
 *   · 옮기고 크기를 바꾸면 그 자리를 적어 둔다 (0.8초마다 살핀다)
 *   · 앱을 다시 열면 지난번에 띄워 둔 것을 그 자리에 되살린다
 *
 * 주소 줄에 대해: 브라우저 탭에서 띄운 창에는 브라우저가 얇은 띠를 붙인다.
 * 웹 페이지가 그것을 지울 수는 없다 (어디서 온 창인지 감추면 속임수에 쓰이기 때문).
 * 앱으로 설치해 쓰면 그 띠가 없는 앱 창으로 뜨고, 껍데기 없이 한 장만 볼 때는
 * 「모아 보기」(Document PiP) 를 쓴다.
 */

const COLORS = ['#FFEB3B', '#FFC1A6', '#A6E3FF', '#C8E6C9', '#E1BEE7', '#FFCDD2']

/** 색은 우리 팔레트 여섯 가지뿐 — 저장소를 손으로 고쳐도 엉뚱한 값이 창에 들어가지 않게 */
function safePaper(c: string): string {
  return COLORS.includes((c || '').toUpperCase()) ? c : COLORS[0]
}

const opened = new Map<string, Window>()
let watching = 0

/** 앱이 앱 창(설치된 모습)으로 돌고 있나 — 그러면 새 창에도 주소 띠가 없다 */
export function standalone(): boolean {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: window-controls-overlay)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true)
}

/**
 * 창의 뼈대 — 새 창은 빈 문서로 열리므로 document.write 로 한 번에 심는다.
 * 여기 끼워 넣는 값은 우리가 만든 것뿐이고, 색은 팔레트에 있는 것만 통과시킨다.
 * 사용자가 적은 글은 이 뼈대에 넣지 않는다 — 걸러서 pad.innerHTML 로 따로 넣는다.
 */
function docHtml(p: Postit): string {
  const paper = safePaper(p.color)
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>포스트잇</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; font-family: "Malgun Gothic", system-ui, sans-serif; }
  body { display: flex; flex-direction: column; background: ${paper}; }
  .bar {
    display: flex; align-items: center; gap: 2px; padding: 3px 4px; flex: none;
    background: rgba(0,0,0,0.07); border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .bar button {
    border: 0; background: transparent; cursor: pointer; border-radius: 4px;
    font-size: 13px; line-height: 1; padding: 4px 6px; color: #2b2b2b; min-width: 24px;
  }
  .bar button:hover { background: rgba(0,0,0,0.12); }
  .bar .b { font-weight: 800; }
  .bar .i { font-style: italic; }
  .bar .u { text-decoration: underline; }
  .bar .sp { flex: 1; }
  .dot { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.2); padding: 0; min-width: 0; }
  .dot.on { outline: 2px solid rgba(0,0,0,0.45); outline-offset: 1px; }
  #pad {
    flex: 1; overflow: auto; padding: 10px 12px; outline: none;
    font-size: 14px; line-height: 1.6; color: #222;
  }
  #pad:empty::before { content: '짧은 메모…'; color: rgba(0,0,0,0.35); }
  #pad ul, #pad ol { margin: 4px 0; padding-left: 20px; }
</style></head><body>
  <div class="bar">
    <button class="b" data-cmd="bold" title="굵게 (Ctrl+B)">B</button>
    <button class="i" data-cmd="italic" title="기울임 (Ctrl+I)">I</button>
    <button class="u" data-cmd="underline" title="밑줄 (Ctrl+U)">U</button>
    <button data-cmd="insertUnorderedList" title="글머리 기호">•</button>
    <button data-cmd="insertOrderedList" title="번호 목록">1.</button>
    <button data-color="#c0392b" style="color:#c0392b" title="빨강 글자">A</button>
    <button data-color="#1f6feb" style="color:#1f6feb" title="파랑 글자">A</button>
    <button data-color="" title="글자색 지우기">A</button>
    <span class="sp"></span>
    ${COLORS.map((c) => `<button class="dot${c === paper ? ' on' : ''}" data-paper="${c}" style="background:${c}" title="메모지 색"></button>`).join('')}
    <button data-close="1" title="치우기 (다시 열 때까지 목록에 남는다)">×</button>
  </div>
  <div id="pad" contenteditable="true" spellcheck="false"></div>
</body></html>`
}

/** 창 안에서 도는 짐 — 편집기 손잡이와 저장 */
function wire(win: Window, p: Postit, onChange: () => void) {
  const doc = win.document
  const pad = doc.getElementById('pad') as HTMLElement | null
  if (!pad) return
  /* 저장된 글도 한 번 더 걸러 넣는다 (옛 기록이나 손으로 고친 저장소에 딴 것이 섞일 수 있다) */
  pad.innerHTML = cleanPostitHtml(postitHtml(p))

  const saveNow = () => {
    updatePostit(p.id, { html: pad.innerHTML })
    onChange()
  }
  let timer = 0
  const saveSoon = () => {
    win.clearTimeout(timer)
    timer = win.setTimeout(saveNow, 250)
  }
  pad.addEventListener('input', saveSoon)
  pad.addEventListener('blur', saveNow)

  doc.querySelectorAll<HTMLButtonElement>('.bar button').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault())   // 초점을 뺏지 않는다
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd
      const color = btn.dataset.color
      const paper = btn.dataset.paper
      if (btn.dataset.close) {
        updatePostit(p.id, { open: false, html: pad.innerHTML })
        onChange()
        win.close()
        return
      }
      if (paper) {
        doc.body.style.background = paper
        doc.querySelectorAll('.dot').forEach((d) => d.classList.toggle('on', (d as HTMLElement).dataset.paper === paper))
        updatePostit(p.id, { color: paper })
        onChange()
        return
      }
      pad.focus()
      if (cmd) doc.execCommand(cmd)
      else if (color !== undefined) doc.execCommand('foreColor', false, color || '#222222')
      saveSoon()
    })
  })

  /* 자리와 크기를 적어 둔다 — 창을 옮겼는지 알려 주는 사건이 없어 살펴 가며 적는다 */
  let last = ''
  const box = win.setInterval(() => {
    if (win.closed) { win.clearInterval(box); return }
    const now = `${win.screenX},${win.screenY},${win.outerWidth},${win.outerHeight}`
    if (now === last) return
    last = now
    updatePostit(p.id, { x: win.screenX, y: win.screenY, w: win.outerWidth, h: win.outerHeight })
  }, 800)

  /* 브라우저·컴퓨터를 끄면 「띄워 둔 채」 로 남는다 — 다시 열 때 되살리기 위해 */
  win.addEventListener('pagehide', () => {
    updatePostit(p.id, { html: pad.innerHTML })
    opened.delete(p.id)
    onChange()
  })
}

/** 포스트잇 한 장을 자기 창에 띄운다 */
export function openOne(p: Postit, onChange: () => void = () => {}): boolean {
  const already = opened.get(p.id)
  if (already && !already.closed) { already.focus(); return true }

  const w = Math.max(200, p.w || 280)
  const h = Math.max(160, p.h || 260)
  /* 자리를 적어 둔 것이 없으면 화면 오른쪽 위부터 조금씩 밀어 놓는다 (겹쳐 쌓이지 않게) */
  const n = opened.size
  const x = p.x ?? Math.max(0, (window.screen?.availWidth || 1280) - w - 40 - n * 24)
  const y = p.y ?? 80 + n * 24
  const win = window.open('', 'justpin_' + p.id, `popup=yes,width=${w},height=${h},left=${x},top=${y}`)
  if (!win) return false

  win.document.write(docHtml(p))
  win.document.close()
  updatePostit(p.id, { open: true, x, y, w, h })
  opened.set(p.id, win)
  wire(win, p, onChange)
  onChange()

  if (!watching) {
    /* 창이 사라졌는지 지켜본다 (닫힘을 알려 주는 사건이 없는 브라우저도 있다) */
    watching = window.setInterval(() => {
      let changed = false
      opened.forEach((w2, id) => { if (w2.closed) { opened.delete(id); changed = true } })
      if (changed) onChange()
      if (opened.size === 0) { window.clearInterval(watching); watching = 0 }
    }, 1500)
  }
  return true
}

/** 목록에 있는 것을 모두 각자 창에 띄운다 */
export function openAll(onChange: () => void = () => {}): number {
  let count = 0
  listPostits().forEach((p) => { if (openOne(p, onChange)) count++ })
  return count
}

/** 지난번에 띄워 둔 것을 되살린다 — 껐다 켜도 그 자리에 */
export function reopenSaved(onChange: () => void = () => {}): number {
  const list = reopenList()
  let count = 0
  list.forEach((p) => { if (openOne(p, onChange)) count++ })
  if (count < list.length) {
    flash(`포스트잇 ${list.length - count}장은 새 창이 막혀 못 띄웠다 — 브라우저에서 팝업을 허용한다`, 3200)
  }
  return count
}

/** 지금 창이 떠 있는 포스트잇 id */
export function openedIds(): string[] {
  return [...opened.entries()].filter(([, w]) => !w.closed).map(([id]) => id)
}

/** 되살릴 것이 있나 (아직 안 띄운 것만 센다) */
export function pendingReopen(): number {
  const live = new Set(openedIds())
  return reopenList().filter((p) => !live.has(p.id)).length
}
