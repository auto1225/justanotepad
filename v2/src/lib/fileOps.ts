import { errText } from './errText'
import { DOC_EXPORT_CSS } from './docCss'
import { resolveBlobRefsInHtml } from './blobRefs'


/** File System Access API — lib.dom 에 아직 없어 쓰는 만큼만 타입을 둔다 */
interface FsaPickerOptions {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
  multiple?: boolean
}
interface FsaWindow {
  showSaveFilePicker?: (o?: FsaPickerOptions) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (o?: FsaPickerOptions) => Promise<FileSystemFileHandle[]>
}
const fsaWindow = (): FsaWindow => window as unknown as FsaWindow

/** 사용자가 파일 선택창을 닫은 경우 — 오류가 아니라 취소다 */
const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** 허락이 없어서 막힌 것인가 (자리·용량 문제와 구분해야 알맞게 안내한다) */
const isPermissionError = (e: unknown) =>
  e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')

/* 어떤 브라우저·환경은 자리를 고르게 해 놓고도 그 파일에 쓰는 것을 막는다
   (내장 브라우저·정책 제한 등: "not allowed by the user agent or the platform").
   한 번 막힌 것을 기억해 두어야 저장할 때마다 창이 두 번 뜨지 않는다. */
const FSA_BLOCKED_KEY = 'jan:v2:fsa-write-blocked'
let fsaBlockedMemo: boolean | null = null

function fsaWriteBlocked(): boolean {
  if (fsaBlockedMemo !== null) return fsaBlockedMemo
  try {
    fsaBlockedMemo = localStorage.getItem(FSA_BLOCKED_KEY) === '1'
  } catch {
    fsaBlockedMemo = false
  }
  return fsaBlockedMemo
}

/**
 * 이 환경에서 「자리를 골라 그 파일에 쓰기」가 될 법한가.
 *
 * 창 안의 창(iframe·내장 브라우저)에서는 브라우저가 쓰기를 막는다 —
 * 그런 자리에서 파일 창을 띄우면 사용자는 창을 두 번 보고 한 번은 헛수고를 한다.
 * 될 법하지 않으면 처음부터 내려받기로 저장한다 (설정을 만질 일이 없게).
 */
function fsaWriteUsable(): boolean {
  if (typeof fsaWindow().showSaveFilePicker !== 'function') return false
  if (fsaWriteBlocked()) return false
  try {
    if (window.self !== window.top) return false // 내장·삽입된 화면
  } catch {
    return false // 크로스 오리진이라 확인조차 막힌다 = 내장된 화면이다
  }
  return true
}

function markFsaWriteBlocked(): void {
  fsaBlockedMemo = true
  try { localStorage.setItem(FSA_BLOCKED_KEY, '1') } catch { /* 저장소가 막혀 있어도 이 세션 동안은 기억한다 */ }
}

/** 다시 쓸 수 있게 된 환경을 위해 되돌리는 길도 둔다 (설정에서 부른다) */
export function allowFsaWriteAgain(): void {
  fsaBlockedMemo = false
  try { localStorage.removeItem(FSA_BLOCKED_KEY) } catch { /* 무시 */ }
}

/** 파일 손잡이에 쓰기 허락 받기 — 이미 있으면 묻지 않는다 */
async function ensureWritePermission(handle: FileSystemFileHandle, mayAsk: boolean): Promise<boolean> {
  const fs = handle as unknown as {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>
  }
  try {
    if (typeof fs.queryPermission === 'function') {
      const state = await fs.queryPermission({ mode: 'readwrite' })
      if (state === 'granted') return true
      if (state === 'denied' || !mayAsk) return false
    }
    if (typeof fs.requestPermission !== 'function') return true // 이 브라우저에는 없는 단계다 — 그냥 써 본다
    return (await fs.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return true // 물어볼 수 없으면 실제 쓰기에서 판가름 난다
  }
}

export interface SaveOptions {
  title?: string
  content: string
  handle?: FileSystemFileHandle | null
  /** 이 문서의 쪽 설정 — 파일 안에 함께 넣어 두면 다시 열 때 그대로 살아난다 */
  pageSettings?: unknown
  /** 자동 저장처럼 사람이 누르지 않은 저장 — 창을 띄우거나 내려받기로 새지 않는다 */
  silent?: boolean
}

export interface SaveResult {
  ok: boolean
  handle?: FileSystemFileHandle
  error?: string
  /** 쓰기 허락이 없어서 못 썼다 — 부르는 쪽에서 「다른 이름」을 권할 수 있다 */
  needsPermission?: boolean
}

export interface OpenFileResult {
  content: string
  handle?: FileSystemFileHandle | null
  title: string
  /** 파일에 적혀 있던 쪽 설정 (없으면 undefined — 기본 판형으로 연다) */
  pageSettings?: unknown
}

export async function saveToFile(opts: SaveOptions): Promise<SaveResult> {
  const { title = '새 메모', content, handle, pageSettings, silent = false } = opts

  let targetHandle = handle ?? null
  if (targetHandle || fsaWriteUsable()) {
    /* 자리 고르기가 먼저다 — 그림을 실제 자료로 바꾸는 일(수백 KB)을 앞에 두면
       그 사이에 "사용자가 방금 누름" 상태가 풀려 브라우저가 창을 막는다.
       (Failed to execute 'createWritable' … not allowed … in the current context) */
    if (!targetHandle) {
      try {
        targetHandle = await fsaWindow().showSaveFilePicker!({
          suggestedName: `${title}.html`,
          types: [{
            description: 'HTML 문서',
            accept: { 'text/html': ['.html', '.htm'] },
          }],
        })
      } catch (err) {
        if (isAbort(err)) return { ok: false, error: '취소됨' }
        console.warn('[fileOps] 저장 위치 고르기 실패, 내려받기로 대신한다:', err)
        targetHandle = null
      }
    }
  }

  // 그림은 janref: 대신 실제 그림 자료를 넣는다 — 안 그러면 파일을 열었을 때 그림이 깨진다
  const file = wrapHtml(title, await resolveBlobRefsInHtml(content), pageSettings)

  if (targetHandle) {
    /* 쓰기 허락을 먼저 확인한다 — 창을 새로 띄우지 않고 조용히 실패하는 가장 흔한 원인이다.
       (탭을 다시 연 뒤나 자동 저장처럼 누른 직후가 아닐 때 허락이 풀려 있다) */
    const permitted = await ensureWritePermission(targetHandle, !silent)
    if (permitted) {
      try {
        const writable = await targetHandle.createWritable()
        await writable.write(file)
        await writable.close()
        allowFsaWriteAgain() // 이 환경은 잘 쓴다 — 예전에 막혔던 기억은 지운다
        return { ok: true, handle: targetHandle }
      } catch (err) {
        if (isAbort(err)) return { ok: false, error: '취소됨' }
        if (!isPermissionError(err)) return { ok: false, error: errText(err) }
        // 이 환경은 고른 자리에 쓸 수 없다 — 다음부터는 자리 고르기를 건너뛴다 (창이 두 번 뜨지 않게)
        markFsaWriteBlocked()
        console.warn('[fileOps] 쓰기 허락이 없어 내려받기로 대신한다:', err)
      }
    }
    /* 사용자가 허락을 거절한 것뿐이라면 환경 탓이 아니다 —
       그때는 기억해 두지 않고(다음에 다시 물을 수 있게) 이번만 내려받기로 건넨다 */
    /* 여기까지 왔으면 그 자리에는 쓸 수 없다 —
       자동 저장이면 조용히 넘기고(내려받기 폭탄 방지), 사람이 누른 저장이면 내려받기로 건넨다 */
    if (silent) return { ok: false, error: '이 파일에 쓸 권한이 없다 — 「다른 이름」으로 다시 저장해라', needsPermission: true }
  }

  try {
    const blob = new Blob([file], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: errText(err) }
  }
}

export async function openFile(): Promise<OpenFileResult | null> {
  if (typeof fsaWindow().showOpenFilePicker === 'function') {
    try {
      const [handle] = await fsaWindow().showOpenFilePicker!({
        types: [{
          description: 'HTML 문서',
          accept: { 'text/html': ['.html', '.htm'] },
        }],
        multiple: false,
      })
      const file = await handle.getFile()
      return readOpenedFile(file, handle)
    } catch (err) {
      if (isAbort(err)) return null
      console.warn('[fileOps] FSA open failed, fallback:', err)
    }
  }

  return openFileWithInput()
}

function openFileWithInput(): Promise<OpenFileResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'text/html,.html,.htm'
    input.style.position = 'fixed'
    input.style.left = '-9999px'

    let settled = false
    const cleanup = () => {
      input.removeEventListener('change', onChange)
      window.removeEventListener('focus', onFocus)
      input.remove()
    }
    const settle = (value: OpenFileResult | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }
    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }
    const onFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) settle(null)
      }, 500)
    }
    const onChange = () => {
      const file = input.files?.[0]
      if (!file) {
        settle(null)
        return
      }
      readOpenedFile(file, null).then(settle).catch(fail)
    }

    input.addEventListener('change', onChange)
    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

async function readOpenedFile(file: File, handle?: FileSystemFileHandle | null): Promise<OpenFileResult> {
  const text = await file.text()
  const title = file.name.replace(/\.(html|htm)$/i, '')
  const content = extractBody(text)
  return { content, handle, title, pageSettings: readPageSettings(text) }
}

/** 파일에 적힌 쪽 설정 — 없으면 undefined (부르는 쪽에서 기본 판형을 쓴다) */
export function readPageSettings(html: string): unknown {
  const head = html.slice(0, 8000)
  const m = head.match(new RegExp(`<meta[^>]+name=["']${PAGE_SETTINGS_META}["'][^>]*content=["']([^"']*)["']`, 'i'))
  if (!m) return undefined
  try {
    const json = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 쪽 설정을 파일 머리에 적어 둘 표 — 다시 열 때 이 문서만의 판형이 그대로 살아난다 */
const PAGE_SETTINGS_META = 'jan-page-settings'

export function wrapHtml(title: string, content: string, pageSettings?: unknown): string {
  const meta = pageSettings
    ? `\n<meta name="${PAGE_SETTINGS_META}" content="${escapeHtml(JSON.stringify(pageSettings))}">`
    : ''
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">${meta}
<title>${escapeHtml(title)}</title>
<style>${DOC_EXPORT_CSS}</style>
</head>
<body>
${content}
</body>
</html>`
}

function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return m ? m[1].trim() : html
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c])
}
