/**
 * Phase 5+ — JustPin 포스트잇.
 *
 * 환경 분기:
 *   - Tauri (window.__TAURI__ 존재): postit_spawn 명령 → 항상 위 native 창
 *   - 브라우저: window.open 으로 sticky-note popup
 *
 * v1 의 postit-desktop.js + Rust postit_list/spawn/self_update 와 호환.
 */
const STORAGE = 'jan-v2-postits'

export interface Postit {
  id: string
  /** 평문 — 옛 문서와 목록 미리보기가 쓴다 (html 에서 뽑아 함께 저장한다) */
  text: string
  /** 서식 있는 글 (굵게·기울임·색·글머리) — 새로 쓰는 값 */
  html?: string
  color: string
  createdAt: number
  /** 창 자리와 크기 — 껐다 켜도 그 자리에 다시 띄우기 위해 적어 둔다 */
  x?: number
  y?: number
  w?: number
  h?: number
  /** 지난번에 띄워 두었나 — 앱을 다시 열면 이것만 되살린다 */
  open?: boolean
}

/** 포스트잇에서 허용하는 서식만 남긴다 (창 안에서 만든 글도 다시 들어올 때 한 번 더 걸러 준다) */
const ALLOWED = /^(B|I|U|STRONG|EM|BR|DIV|P|SPAN|UL|OL|LI|FONT)$/

export function cleanPostitHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const box = document.createElement('div')
  box.innerHTML = html
  box.querySelectorAll('*').forEach((el) => {
    if (!ALLOWED.test(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes))
      return
    }
    /* 남기는 것은 글자색뿐 — 나머지 속성(onclick·style 배경 등)은 걷는다 */
    const color = (el as HTMLElement).style?.color || ''
    Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name))
    if (color) (el as HTMLElement).style.color = color
  })
  return box.innerHTML
}

/** 서식 있는 글에서 평문을 뽑는다 (목록 미리보기·검색용) */
export function postitPlainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const box = document.createElement('div')
  box.innerHTML = html
  return (box.textContent || '').trim()
}

declare global {
  interface Window {
    __TAURI__?: {
      core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }
    }
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI__?.core?.invoke
}

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    return (await window.__TAURI__!.core!.invoke(cmd, args)) as T
  } catch (e) {
    console.warn('[justpin invoke]', cmd, e)
    return null
  }
}

function load(): Postit[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '[]')
  } catch {
    return []
  }
}
function save(list: Postit[]) {
  localStorage.setItem(STORAGE, JSON.stringify(list))
}

export function listPostits(): Postit[] {
  return load()
}

export function addPostit(text: string, color = '#FFEB3B'): Postit {
  const p: Postit = {
    id: 'p' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    text,
    html: text ? `<div>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c)).replace(/\n/g, '</div><div>')}</div>` : '',
    color,
    createdAt: Date.now(),
    open: true,
  }
  const list = load()
  list.unshift(p)
  save(list)
  return p
}

/**
 * 포스트잇을 고친다. html 을 주면 평문도 함께 맞춰 둔다 —
 * 목록 미리보기와 검색은 평문을 보고, 창은 서식 있는 글을 본다.
 */
export function updatePostit(
  id: string,
  patch: Partial<Pick<Postit, 'text' | 'html' | 'color' | 'x' | 'y' | 'w' | 'h' | 'open'>>,
): Postit | null {
  const list = load()
  const at = list.findIndex((p) => p.id === id)
  if (at < 0) return null
  const next = { ...list[at], ...patch }
  if (patch.html !== undefined) {
    next.html = cleanPostitHtml(patch.html)
    next.text = postitPlainText(next.html)
  } else if (patch.text !== undefined && patch.html === undefined) {
    /* 평문만 고쳤으면 서식 글도 그 평문으로 맞춘다 (엇갈린 두 값이 남지 않게) */
    next.html = patch.text
      ? `<div>${patch.text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c)).replace(/\n/g, '</div><div>')}</div>`
      : ''
  }
  list[at] = next
  save(list)
  return next
}

/** 이 포스트잇의 서식 있는 글 (옛 문서는 평문뿐이라 그것으로 만들어 준다) */
export function postitHtml(p: Postit): string {
  if (p.html) return p.html
  const safe = (p.text || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))
  return safe ? `<div>${safe.replace(/\n/g, '</div><div>')}</div>` : ''
}

/** 지난번에 띄워 두었던 것들 — 앱을 다시 열 때 되살릴 목록 */
export function reopenList(): Postit[] {
  return load().filter((p) => p.open)
}

export function removePostit(id: string) {
  save(load().filter((p) => p.id !== id))
  // Tauri 환경이면 native 창도 닫기 시도
  if (isTauri()) {
    tauriInvoke('postit_self_close', { id }).catch(() => {})
  }
}

/** 색상 hex → Tauri Rust 가 기대하는 이름 매핑. */
const TAURI_COLOR_MAP: Record<string, string> = {
  '#FFEB3B': 'yellow',
  '#FFC1A6': 'peach',
  '#A6E3FF': 'sky',
  '#C8E6C9': 'mint',
  '#E1BEE7': 'lavender',
  '#FFCDD2': 'pink',
}

/**
 * 포스트잇 창 띄우기.
 * Tauri 면 postit_spawn, 브라우저면 window.open.
 */
export async function openPostitWindow(p: Postit): Promise<boolean> {
  if (isTauri()) {
    const tauriColor = TAURI_COLOR_MAP[p.color] || 'yellow'
    const r = await tauriInvoke<string>('postit_spawn', {
      id: p.id,
      color: tauriColor,
      content: p.text,
      x: 120,
      y: 120,
      w: 280,
      h: 240,
    })
    return !!r
  }

  // 브라우저 폴백 — sticky-note popup
  const safe = (p.text || '').replace(
    /[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c)
  )
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JustPin</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:${p.color};font-family:"Malgun Gothic",sans-serif;}
  textarea{box-sizing:border-box;width:100%;height:calc(100% - 32px);background:transparent;border:0;outline:none;padding:14px;font-size:14px;line-height:1.5;resize:none;}
  .bar{height:32px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;background:rgba(0,0,0,0.06);}
  .bar button{background:none;border:0;cursor:pointer;font-size:14px;padding:0 8px;}
</style></head><body>
  <div class="bar"><button onclick="window.close()" title="닫기">×</button></div>
  <textarea id="t" placeholder="짧은 메모...">${safe}</textarea>
  <script>
    const ta = document.getElementById('t');
    const id = '${p.id}';
    ta.addEventListener('input', () => {
      try {
        const list = JSON.parse(localStorage.getItem('${STORAGE}') || '[]');
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) { list[i].text = ta.value; localStorage.setItem('${STORAGE}', JSON.stringify(list)); }
      } catch(e) {}
    });
  <${'/'}script>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, 'justpin_' + p.id, 'width=320,height=320,resizable=yes')
  if (!win) {
    URL.revokeObjectURL(url)
    alert('팝업 차단을 해제하세요')
    return false
  }
  // 1분 후 blob URL 정리 (창은 srcdoc 로드 끝났으므로 OK)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return true
}

/** Tauri 환경에서 모든 native 포스트잇 동기화 (앱 시작 시). */

/** 데스크톱(타우리) 쪽 포스트잇 레코드 — 쓰는 항목만 */
interface TauriPostit {
  id: string
  content?: string
  color?: string
  x?: number
  y?: number
  w?: number
  h?: number
  pinned?: boolean
  updated_at?: number
}

export async function tauriSyncOnBoot() {
  if (!isTauri()) return
  const list = await tauriInvoke<TauriPostit[]>('postit_list')
  if (!Array.isArray(list)) return
  const local = load()
  const localIds = new Set(local.map((p) => p.id))
  for (const t of list) {
    if (!localIds.has(t.id)) {
      local.push({
        id: t.id,
        text: t.content || '',
        color: t.color || '#FFEB3B',
        createdAt: t.updated_at || Date.now(),
      })
    }
  }
  save(local)
}

export const isTauriEnv = isTauri
