import { errText } from './errText'
import { DOC_EXPORT_CSS } from './docCss'
import { resolveBlobRefsInHtml } from './blobRefs'
import { JAN_EXT, JAN_MIME, isJanName, packJan, unpackJan } from './janFormat'


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

/* 반대로, 이 환경에서 자리 지정 저장이 "된다"는 것을 확인한 기억.
   한 번이라도 성공해 봐야 그 다음부터 파일 창을 믿고 띄운다. */
const FSA_OK_KEY = 'jan:v2:fsa-write-ok'
let fsaOkMemo: boolean | null = null

function fsaWriteProven(): boolean {
  if (fsaOkMemo !== null) return fsaOkMemo
  try {
    fsaOkMemo = localStorage.getItem(FSA_OK_KEY) === '1'
  } catch {
    fsaOkMemo = false
  }
  return fsaOkMemo
}

function markFsaWriteProven(): void {
  fsaOkMemo = true
  try { localStorage.setItem(FSA_OK_KEY, '1') } catch { /* 이 세션 동안만 기억해도 된다 */ }
}

/**
 * 이 환경에서 「자리를 골라 그 파일에 쓰기」를 시도해도 되는가.
 *
 * 기본은 "아니오"다 — 될지 안 될지 모르는 채로 파일 창을 띄우면,
 * 막히는 환경(내장 브라우저·정책 제한)에서는 창을 두 번 보고 한 번은 헛수고를 한다.
 * 그래서 자리 지정은 사용자가 「다른 이름」으로 분명히 시킬 때(pick)와,
 * 그렇게 해서 한 번 성공해 본 환경에서만 쓴다. 그 밖에는 조용히 내려받기로 저장한다.
 */
function fsaWriteUsable(pick: boolean): boolean {
  if (typeof fsaWindow().showSaveFilePicker !== 'function') return false
  if (fsaWriteBlocked()) return false
  try {
    if (window.self !== window.top) return false // 내장·삽입된 화면에서는 브라우저가 막는다
  } catch {
    return false // 크로스 오리진이라 확인조차 막힌다 = 내장된 화면이다
  }
  return pick || fsaWriteProven()
}

function markFsaWriteBlocked(): void {
  fsaBlockedMemo = true
  try { localStorage.setItem(FSA_BLOCKED_KEY, '1') } catch { /* 저장소가 막혀 있어도 이 세션 동안은 기억한다 */ }
}

/** 다시 쓸 수 있게 된 환경을 위해 되돌리는 길도 둔다 (설정에서 부른다) */
export function allowFsaWriteAgain(): void {
  fsaBlockedMemo = false
  fsaOkMemo = false
  try {
    localStorage.removeItem(FSA_BLOCKED_KEY)
    localStorage.removeItem(FSA_OK_KEY)
  } catch { /* 무시 */ }
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
  /** 「다른 이름」처럼 사용자가 저장 자리를 고르겠다고 분명히 시킨 저장 */
  pick?: boolean
  /** 저장 형식 — 기본은 우리 문서 형식(.jan). 손잡이가 있으면 그 파일의 확장자를 따른다 */
  format?: DocFormat
}

/** 우리 문서 형식(.jan) 과, 다른 프로그램과 주고받는 한 장짜리 HTML */
export type DocFormat = 'jan' | 'html'

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
  const { title = '새 메모', content, handle, pageSettings, silent = false, pick = false } = opts
  // 이미 어떤 파일에 매여 있으면 그 파일의 형식을 따른다 (.html 로 저장해 둔 문서를 .jan 으로 바꿔치지 않는다)
  let format: DocFormat = opts.format ?? (handle?.name && !isJanName(handle.name) ? 'html' : 'jan')

  let targetHandle = handle ?? null
  let justPicked = false // 이번에 창을 띄워 고른 자리인가 (막힘의 원인을 가리는 데 쓴다)
  if (targetHandle || fsaWriteUsable(pick)) {
    /* 자리 고르기가 먼저다 — 그림을 실제 자료로 바꾸는 일(수백 KB)을 앞에 두면
       그 사이에 "사용자가 방금 누름" 상태가 풀려 브라우저가 창을 막는다.
       (Failed to execute 'createWritable' … not allowed … in the current context) */
    if (!targetHandle) {
      try {
        targetHandle = await fsaWindow().showSaveFilePicker!({
          suggestedName: `${title}${format === 'html' ? '.html' : JAN_EXT}`,
          types: [
            { description: 'JustANotepad 문서', accept: { [JAN_MIME]: [JAN_EXT] } },
            { description: 'HTML 문서 (다른 프로그램과 주고받기)', accept: { 'text/html': ['.html', '.htm'] } },
          ],
        })
        justPicked = true
        // 사용자가 창에서 고른 확장자가 곧 형식이다
        if (targetHandle?.name) format = isJanName(targetHandle.name) ? 'jan' : 'html'
      } catch (err) {
        if (isAbort(err)) return { ok: false, error: '취소됨' }
        console.warn('[fileOps] 저장 위치 고르기 실패, 내려받기로 대신한다:', err)
        targetHandle = null
      }
    }
  }

  /* 우리 형식은 그림을 따로 담은 묶음(zip), HTML 은 그림을 본문에 넣은 한 장.
     어느 쪽이든 그림이 살아 있어야 한다 — janref: 를 실제 자료로 되돌린다. */
  const file: Blob | string = format === 'jan'
    ? await packJan({ title, html: content, pageSettings, savedAt: Date.now() })
    : wrapHtml(title, await resolveBlobRefsInHtml(content), pageSettings)

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
        markFsaWriteProven() // 이제부터는 그냥 「저장」도 이 자리에 곧바로 쓴다
        return { ok: true, handle: targetHandle }
      } catch (err) {
        if (isAbort(err)) return { ok: false, error: '취소됨' }
        if (!isPermissionError(err)) return { ok: false, error: errText(err) }
        // 이 환경은 고른 자리에 쓸 수 없다 — 다음부터는 자리 고르기를 건너뛴다 (창이 두 번 뜨지 않게)
        markFsaWriteBlocked()
        console.warn('[fileOps] 쓰기 허락이 없어 내려받기로 대신한다:', err)
      }
    }
    /* 방금 창을 띄워 고른 자리인데도 못 쓴다면 그건 이 환경이 막는 것이다 —
       기억해 두지 않으면 저장할 때마다 창이 두 번(자리 고르기 + 내려받기) 뜬다.
       예전 세션에서 물려받은 손잡이라면 사용자가 거절했을 수도 있으니 기억하지 않는다. */
    if (justPicked) markFsaWriteBlocked()
    /* 여기까지 왔으면 그 자리에는 쓸 수 없다 —
       자동 저장이면 조용히 넘기고(내려받기 폭탄 방지), 사람이 누른 저장이면 내려받기로 건넨다 */
    if (silent) return { ok: false, error: '이 파일에 쓸 권한이 없다 — 「다른 이름」으로 다시 저장해라', needsPermission: true }
  }

  try {
    const blob = typeof file === 'string' ? new Blob([file], { type: 'text/html' }) : file
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}${format === 'html' ? '.html' : JAN_EXT}`
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
          description: '문서 파일',
          accept: { [JAN_MIME]: [JAN_EXT], 'text/html': ['.html', '.htm'] },
        }],
        multiple: false,
      })
      const file = await handle.getFile()
      return readAnyDocumentFile(file, handle)
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
    input.accept = `${JAN_EXT},text/html,.html,.htm`
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
      readAnyDocumentFile(file, null).then(settle).catch(fail)
    }

    input.addEventListener('change', onChange)
    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

/** 파일 하나를 우리 문서로 읽어들인다 (.jan 묶음 · HTML 한 장 모두) */
export async function readAnyDocumentFile(file: File, handle?: FileSystemFileHandle | null): Promise<OpenFileResult> {
  const nameTitle = file.name.replace(/\.(jan|html|htm)$/i, '')
  // 우리 형식은 묶음(zip)이다 — 이름이나 파일 첫머리(PK)로 알아본다
  if (isJanName(file.name) || await looksLikeZip(file)) {
    const doc = await unpackJan(await file.arrayBuffer())
    return { content: doc.html, handle, title: doc.title || nameTitle, pageSettings: doc.pageSettings }
  }
  const text = await file.text()
  return { content: extractBody(text), handle, title: nameTitle, pageSettings: readPageSettings(text) }
}

/** 파일 첫 두 글자가 PK 면 zip 묶음이다 (확장자를 바꿔 두었어도 알아본다) */
async function looksLikeZip(file: Blob): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
    return head[0] === 0x50 && head[1] === 0x4b
  } catch {
    return false
  }
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
