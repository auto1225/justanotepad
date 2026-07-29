import JSZip from 'jszip'
import { resolveBlobRefsInHtml } from './blobRefs'

/**
 * JustANotepad 문서 형식 (.jan) — 워드의 .docx, 한글의 .hwpx 자리.
 *
 * 왜 HTML 한 장으로는 모자란가:
 *  - 그림을 본문에 base64 로 박아 넣어야 해서 파일이 1.4배로 부풀고, 편집기가 버벅인다
 *  - 쪽 설정·제목 같은 문서 정보를 <meta> 한 줄에 욱여넣게 된다
 *  - 나중에 붙일 것(각주 자료·글꼴·첨부)을 담을 자리가 없다
 *
 * 그래서 docx·hwpx 와 같은 방식(ZIP 묶음)을 쓴다:
 *
 *   보고서.jan
 *   ├─ mimetype          application/x-justanotepad+zip   (무압축 — 파일 첫머리로 형식을 알아본다)
 *   ├─ jan.json          { version, title, pageSettings, savedAt }
 *   ├─ content.html      본문 (그림은 media/… 로 가리킨다)
 *   └─ media/            그림·소리·영상 원본
 *
 * 열 때는 media 를 다시 본문에 물려서, 편집기는 예전과 똑같은 HTML 한 덩이만 다루면 된다.
 */

export const JAN_MIME = 'application/x-justanotepad+zip'
export const JAN_EXT = '.jan'
const JAN_VERSION = 1

export interface JanDocument {
  title: string
  html: string
  pageSettings?: unknown
  savedAt?: number
}

/** 파일 이름이나 첫머리를 보고 우리 형식인지 가린다 */
export function isJanName(name: string): boolean {
  return /\.jan$/i.test(name.trim())
}

const MEDIA_TAGS = ['img', 'audio', 'video', 'source']

/** data: URL → 바이트 (base64 도 순수 텍스트도 받는다) */
function dataUrlToBytes(url: string): { bytes: Uint8Array; ext: string } | null {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s)
  if (!m) return null
  const [, mime, base64, body] = m
  const ext = mime.split('/')[1]?.split('+')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  try {
    if (base64) {
      const binary = atob(body)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return { bytes, ext }
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(body)), ext }
  } catch {
    return null
  }
}

/** 이 창에 살아 있는 blob: 주소를 실제 바이트로 받아 둔다 */
async function fetchAsBytes(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const mime = res.headers.get('content-type') || 'application/octet-stream'
    const ext = mime.split('/')[1]?.split('+')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
    return { bytes: buf, ext }
  } catch {
    return null
  }
}

/** 문서 한 벌을 .jan 묶음으로 싼다 */
export async function packJan(doc: JanDocument): Promise<Blob> {
  // 그림은 janref: 를 실제 자료로 되돌린 뒤 파일로 떼어 낸다
  const html = await resolveBlobRefsInHtml(doc.html)
  const zip = new JSZip()
  // 첫 항목은 무압축 mimetype — odf·hwpx 와 같은 관례다 (파일 앞부분만 봐도 형식을 안다)
  zip.file('mimetype', JAN_MIME, { compression: 'STORE' })

  const dom = new DOMParser().parseFromString(`<div id="jan-root">${html}</div>`, 'text/html')
  const root = dom.getElementById('jan-root')
  const media = zip.folder('media')
  let n = 0
  if (root && media) {
    for (const tag of MEDIA_TAGS) {
      for (const el of Array.from(root.querySelectorAll(tag))) {
        const src = el.getAttribute('src') || ''
        // data: 는 그 자리에서 풀고, blob: 은 아직 이 창에 살아 있는 동안 받아 둔다
        // (blob: 은 창을 닫으면 사라진다 — 그대로 저장하면 다시 열었을 때 그림이 깨진다)
        const parsed = src.startsWith('data:') ? dataUrlToBytes(src)
          : src.startsWith('blob:') ? await fetchAsBytes(src)
            : null
        if (!parsed) continue
        const name = `m${++n}.${parsed.ext}`
        media.file(name, parsed.bytes)
        el.setAttribute('src', `media/${name}`)
      }
    }
  }

  zip.file('content.html', root ? root.innerHTML : html)
  zip.file('jan.json', JSON.stringify({
    version: JAN_VERSION,
    app: 'JustANotepad',
    title: doc.title,
    pageSettings: doc.pageSettings ?? null,
    savedAt: doc.savedAt ?? null,
    mediaCount: n,
  }, null, 2))

  return zip.generateAsync({ type: 'blob', mimeType: JAN_MIME, compression: 'DEFLATE' })
}

/** .jan 묶음을 풀어 편집기가 바로 쓰는 한 덩이 HTML 로 되돌린다 */
export async function unpackJan(data: Blob | ArrayBuffer | Uint8Array): Promise<JanDocument> {
  const zip = await JSZip.loadAsync(data)
  const contentFile = zip.file('content.html')
  if (!contentFile) throw new Error('이 파일에는 본문(content.html)이 없다')
  let html = await contentFile.async('string')

  const metaFile = zip.file('jan.json')
  let title = ''
  let pageSettings: unknown
  let savedAt: number | undefined
  if (metaFile) {
    try {
      const meta = JSON.parse(await metaFile.async('string'))
      if (typeof meta.title === 'string') title = meta.title
      if (meta.pageSettings && typeof meta.pageSettings === 'object') pageSettings = meta.pageSettings
      if (typeof meta.savedAt === 'number') savedAt = meta.savedAt
    } catch { /* 정보가 깨졌어도 본문은 살린다 */ }
  }

  // media/… 를 다시 본문 안으로 (편집기는 예전처럼 HTML 한 덩이만 다룬다)
  const files = zip.folder('media')?.file(/.*/) ?? []
  for (const file of files) {
    const name = file.name.replace(/^media\//, '')
    if (!html.includes(`media/${name}`)) continue
    const base64 = await file.async('base64')
    const ext = name.split('.').pop()?.toLowerCase() || 'bin'
    html = html.split(`media/${name}`).join(`data:${mimeOf(ext)};base64,${base64}`)
  }

  return { title, html, pageSettings, savedAt }
}

function mimeOf(ext: string): string {
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'svg': return 'image/svg+xml'
    case 'avif': return 'image/avif'
    case 'mp3': return 'audio/mpeg'
    case 'wav': return 'audio/wav'
    case 'mp4': return 'video/mp4'
    case 'webm': return 'video/webm'
    default: return 'application/octet-stream'
  }
}
