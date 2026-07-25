import { errText } from './errText'


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

export interface SaveOptions {
  title?: string
  content: string
  handle?: FileSystemFileHandle | null
}

export interface SaveResult {
  ok: boolean
  handle?: FileSystemFileHandle
  error?: string
}

export interface OpenFileResult {
  content: string
  handle?: FileSystemFileHandle | null
  title: string
}

export async function saveToFile(opts: SaveOptions): Promise<SaveResult> {
  const { title = '새 메모', content, handle } = opts

  if (typeof fsaWindow().showSaveFilePicker === 'function') {
    try {
      let targetHandle = handle
      if (!targetHandle) {
        targetHandle = await fsaWindow().showSaveFilePicker!({
          suggestedName: `${title}.html`,
          types: [{
            description: 'HTML 문서',
            accept: { 'text/html': ['.html', '.htm'] },
          }],
        })
      }
      const writable = await targetHandle!.createWritable()
      await writable.write(wrapHtml(title, content))
      await writable.close()
      return { ok: true, handle: targetHandle! }
    } catch (err) {
      if (isAbort(err)) return { ok: false, error: '취소됨' }
      console.warn('[fileOps] FSA save failed, fallback:', err)
    }
  }

  try {
    const blob = new Blob([wrapHtml(title, content)], { type: 'text/html' })
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
  return { content, handle, title }
}

function wrapHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 11pt; line-height: 1.65; max-width: 210mm; margin: 20mm auto; padding: 0 22mm; }
  p { margin: 0.5em 0; }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; margin: 1em 0 0.3em; }
  table { border-collapse: collapse; }
  table td, table th { border: 1px solid #999; padding: 4px 8px; }
  img { max-width: 100%; }
  blockquote { border-left: 3px solid #d97757; padding: 4px 12px; margin: 0.6em 0; background: rgba(217,119,87,0.05); }
  pre { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; overflow-x: auto; }
  code { background: #f5f5f5; padding: 0 4px; border-radius: 3px; }
</style>
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
