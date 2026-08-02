const DB_NAME = 'jan-v2-content-blobs'
const DB_VERSION = 1
const STORE = 'blobs'
const REF_PREFIX = 'jan-blob://'
const V1_REF_PREFIX = 'idb://'
const DEFAULT_MIN_BYTES = 16 * 1024

let dbPromise: Promise<IDBDatabase> | null = null
const memoryCache = new Map<string, string>()
const objectUrls = new Map<string, string>()

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available'))
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })

  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || tx.error || new Error('IndexedDB request failed'))
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
  })
}

async function hashText(value: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest).slice(0, 12))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    let hash = 0
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
    return (hash >>> 0).toString(16).padStart(8, '0')
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const encoded = match[3] || ''
  try {
    if (match[2]) {
      const binary = atob(encoded)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }
    return new Blob([decodeURIComponent(encoded)], { type: mime })
  } catch {
    return null
  }
}

async function putDataUrl(id: string, dataUrl: string): Promise<void> {
  memoryCache.set(id, dataUrl)
  if (!hasIndexedDb()) return
  await withStore<IDBValidKey>('readwrite', (store) => store.put(dataUrl, id))
}

export function isBlobRef(value: string): boolean {
  return value.startsWith(REF_PREFIX)
}

export function blobRefId(ref: string): string {
  return ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ref
}

export async function saveDataUrlAsBlobRef(dataUrl: string): Promise<string> {
  const id = await hashText(dataUrl)
  await putDataUrl(id, dataUrl)
  return REF_PREFIX + id
}

export async function readBlobRef(ref: string): Promise<string | null> {
  const id = blobRefId(ref)
  if (memoryCache.has(id)) return memoryCache.get(id) || null
  try {
    const value = await withStore<string | undefined>('readonly', (store) => store.get(id))
    if (typeof value === 'string') {
      memoryCache.set(id, value)
      return value
    }
  } catch {
    return null
  }
  return null
}

export async function resolveBlobRefToObjectUrl(ref: string): Promise<string | null> {
  const id = blobRefId(ref)
  if (objectUrls.has(id)) return objectUrls.get(id) || null
  const dataUrl = await readBlobRef(ref)
  if (!dataUrl) return null
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) return dataUrl
  const url = URL.createObjectURL(blob)
  objectUrls.set(id, url)
  return url
}

const DATA_URL_PATTERN = /data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)/g
const V1_REF_PATTERN = /idb:\/\/([a-f0-9]+)/gi

export async function externalizeLargeDataUrlsInHtml(html: string, minBytes = DEFAULT_MIN_BYTES): Promise<string> {
  if (!html.includes('data:')) return html
  const matches = [...html.matchAll(DATA_URL_PATTERN)]
  if (!matches.length) return html

  let next = html
  for (const match of matches) {
    const full = match[0]
    if (full.length < minBytes) continue
    try {
      const ref = await saveDataUrlAsBlobRef(full)
      next = next.split(full).join(ref)
    } catch {
      continue
    }
  }
  return next
}

export async function resolveBlobRefsInHtml(html: string): Promise<string> {
  if (!html.includes(REF_PREFIX)) return html
  const refs = Array.from(new Set(html.match(new RegExp(`${REF_PREFIX}[a-z0-9]+`, 'g')) || []))
  let next = html
  for (const ref of refs) {
    const dataUrl = await readBlobRef(ref)
    if (dataUrl) next = next.split(ref).join(dataUrl)
  }
  return next
}

export async function resolveBlobRefsInElement(root: ParentNode | null): Promise<void> {
  if (!root || !('querySelectorAll' in root)) return
  const elements = Array.from(root.querySelectorAll<HTMLImageElement | HTMLAudioElement | HTMLVideoElement>(`img[src^="${REF_PREFIX}"], audio[src^="${REF_PREFIX}"], video[src^="${REF_PREFIX}"]`))
  for (const element of elements) {
    const src = element.getAttribute('src') || ''
    if (!isBlobRef(src)) continue
    const url = await resolveBlobRefToObjectUrl(src)
    if (url) element.src = url
  }
}

export async function importV1BlobRefsInHtml(html: string): Promise<string> {
  if (!html.includes(V1_REF_PREFIX)) return html
  let db: IDBDatabase | null = null
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('justanotepad', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('v1 IndexedDB open failed'))
    })
  } catch {
    return html
  }

  const ids = Array.from(new Set([...html.matchAll(V1_REF_PATTERN)].map((match) => match[1])))
  let next = html
  for (const id of ids) {
    try {
      const dataUrl = await new Promise<string | null>((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains('blobs')) {
          resolve(null)
          return
        }
        const tx = db.transaction('blobs', 'readonly')
        const request = tx.objectStore('blobs').get(id)
        request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null)
        request.onerror = () => reject(request.error || tx.error)
      })
      if (!dataUrl) continue
      const ref = await saveDataUrlAsBlobRef(dataUrl)
      next = next.split(`idb://${id}`).join(ref)
    } catch {
      continue
    }
  }
  db.close()
  return next
}

export async function getBlobStorageStats(): Promise<{ count: number; bytes: number }> {
  try {
    const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
    let bytes = 0
    for (const key of keys) {
      const value = await withStore<string | undefined>('readonly', (store) => store.get(String(key)))
      bytes += typeof value === 'string' ? value.length : 0
    }
    return { count: keys.length, bytes }
  } catch {
    return { count: 0, bytes: 0 }
  }
}

/**
 * 저장소 주소(jan-blob://)를 계속 지켜보며 진짜 그림으로 바꿔 준다.
 *
 * 예전에는 메모를 바꿀 때 한 번만 바꿨다. 그런데 쪽 나눔이 그림을 다른 쪽으로 옮기면
 * ProseMirror 가 그 자리를 새로 그리고, 새로 그린 img 의 주소는 다시 jan-blob:// 이다.
 * 브라우저는 그 주소를 읽지 못하므로 그림이 통째로 사라진다 —
 * 「그림이 안 나온다」 · 「옮기면 없어진다」 가 모두 이 자리에서 났다.
 *
 * 그래서 한 번이 아니라 계속 본다. 새로 나타난 것만 바꾸므로 하는 일은 거의 없다.
 */
export function watchBlobRefs(root: HTMLElement): () => void {
  let timer: number | undefined
  let running = false

  const run = async () => {
    timer = undefined
    if (running) return
    running = true
    try { await resolveBlobRefsInElement(root) } catch { /* 못 바꾼 것은 다음 기회에 */ }
    finally { running = false }
  }
  const schedule = () => { if (timer === undefined) timer = window.setTimeout(run, 50) }

  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') { schedule(); return }
      for (const n of Array.from(r.addedNodes)) {
        if (n.nodeType !== 1) continue
        const el = n as Element
        if (el.tagName === 'IMG' || el.querySelector?.('img, audio, video')) { schedule(); return }
      }
    }
  })
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
  void run()
  return () => {
    mo.disconnect()
    if (timer !== undefined) window.clearTimeout(timer)
  }
}
