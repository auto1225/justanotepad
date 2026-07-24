/**
 * Phase 11 — 단일 메모 공유 링크 (백엔드 무의존).
 * URL fragment (#) 에 메모 내용을 압축 + base64url 인코딩.
 * 공유 받는 쪽은 같은 v2 앱에서 #share=... fragment 를 디코딩 → read-only 보기.
 *
 * 한계:
 *   - URL 길이 제한 (브라우저별 ~32KB ~ ~64KB) → 짧은 메모만
 *   - 검색엔진 인덱스 X (fragment 는 서버 안 옴)
 *   - 변경 추적 X — 한 번 인코딩한 시점의 정적 스냅샷
 */

interface SharePayload {
  v: 1
  title: string
  content: string
  createdAt: number
}

/** UTF-8 안전 base64url 인코딩 */
function b64UrlEncode(s: string): string {
  const utf8 = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < utf8.length; i++) bin += String.fromCharCode(utf8[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(padded)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(arr)
}

/** CompressionStream gzip — 모던 브라우저 지원. fallback: plain. */
async function gzipString(s: string): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return new TextEncoder().encode(s)
  }
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(s) as any)
  writer.close()
  const reader = cs.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((a, c) => a + c.byteLength, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.byteLength }
  return out
}

async function gunzipBytes(b: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    return new TextDecoder().decode(b)
  }
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(b as any)
  writer.close()
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((a, c) => a + c.byteLength, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.byteLength }
  return new TextDecoder().decode(out)
}

function bytesToB64Url(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function makeShareUrl(payload: SharePayload): Promise<string> {
  const json = JSON.stringify(payload)
  // 4KB 미만 — gzip 없이 base64url
  // 그 이상 — gzip 후 base64url
  let frag: string
  if (json.length < 2048) {
    frag = 'p:' + b64UrlEncode(json)
  } else {
    const gz = await gzipString(json)
    frag = 'g:' + bytesToB64Url(gz)
  }
  if (frag.length > 60000) {
    throw new Error('메모가 너무 커서 URL 공유 불가 (60KB 초과). Markdown export 후 별도 호스팅 권장.')
  }
  const base = `${location.origin}${import.meta.env.BASE_URL || '/v2/'}`
  return `${base}#share=${frag}`
}

export async function readShareFragment(): Promise<SharePayload | null> {
  const h = location.hash || ''
  const m = h.match(/share=([^&]+)/)
  if (!m) return null
  const frag = m[1]
  try {
    if (frag.startsWith('p:')) {
      return JSON.parse(b64UrlDecode(frag.slice(2)))
    } else if (frag.startsWith('g:')) {
      const json = await gunzipBytes(b64UrlToBytes(frag.slice(2)))
      return JSON.parse(json)
    }
  } catch (e) {
    console.warn('[share] decode failed', e)
  }
  return null
}
