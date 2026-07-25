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
  text: string
  color: string
  createdAt: number
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
  const p: Postit = { id: 'p' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6), text, color, createdAt: Date.now() }
  const list = load()
  list.unshift(p)
  save(list)
  return p
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
