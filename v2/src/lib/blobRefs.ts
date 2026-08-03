const DB_NAME = 'jan-v2-content-blobs'
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

function openAt(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

/**
 * 그림 알맹이를 담는 저장소를 연다. 선반이 없으면 새로 짓는다.
 *
 * 선반은 onupgradeneeded 안에서만 지을 수 있는데, 그 자리는 판 번호가 오를 때만 불린다.
 * 그래서 판 1짜리 저장소가 선반 없이 만들어져 버리면 — 판 번호를 주지 않고 연 적이 한 번만
 * 있어도(콘솔에서든 다른 스크립트에서든) 그렇게 된다 — 그 뒤로는 판 1로 열어도
 * onupgradeneeded 가 다시는 불리지 않는다. 선반을 짓는 코드가 있어도 영영 닿지 못하고,
 * 읽기도 쓰기도 NotFoundError 로 끝난다. 실제로 그 꼴이 되어 문서 속 그림이 통째로 사라졌다.
 *
 * 그래서 판 번호를 못박지 않는다. 못박으면 고쳐 놓은 것을 스스로 되부순다 —
 * 선반이 없어 판 2로 올려 지어 놓고는, 다음 실행에서 판 1로 열려다 VersionError 로 죽는다.
 * 지금 판이 무엇이든 그대로 열고(없으면 판 1로 새로 만들고), 그때 선반이 있는지
 * 눈으로 확인해서 없을 때만 판을 올려 짓는다.
 */
function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is not available'))
  if (dbPromise) return dbPromise

  dbPromise = openAt()
    .then((db) => {
      if (db.objectStoreNames.contains(STORE)) return db
      const next = db.version + 1
      db.close()
      return openAt(next)
    })
    .catch((e) => {
      /* 다음에 다시 해 볼 수 있게 놓아 준다 — 붙잡아 두면 이번 판 내내 죽은 채로 남는다 */
      dbPromise = null
      throw e
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
  if (!hasIndexedDb()) { memoryCache.set(id, dataUrl); return }
  /* 저장소에 들어간 것을 보고 나서 기억한다 — 담기지도 않았는데 기억해 두면
     이번 판에서는 보이다가 껐다 켜면 사라진다 */
  await withStore<IDBValidKey>('readwrite', (store) => store.put(dataUrl, id))
  memoryCache.set(id, dataUrl)
}

export function isBlobRef(value: string): boolean {
  return value.startsWith(REF_PREFIX)
}

export function blobRefId(ref: string): string {
  return ref.startsWith(REF_PREFIX) ? ref.slice(REF_PREFIX.length) : ref
}

/**
 * 그림 알맹이를 저장소에 넣고 그 주소를 돌려준다.
 *
 * 넣지 못하면 원래 자료를 그대로 돌려준다. 주소를 돌려주면 그것은 아무것도 가리키지 않는
 * 죽은 주소가 되고, 그림은 문서에서 영영 사라진다. 부르는 쪽마다 예외를 받아 그림을
 * 통째로 버리기도 했다 — 끌어다 놓은 그림이 아무 말 없이 안 들어가던 것이 이것이다.
 * 문서가 무거워지는 편이 그림을 잃는 것보다 낫다.
 */
export async function saveDataUrlAsBlobRef(dataUrl: string): Promise<string> {
  const id = await hashText(dataUrl)
  try {
    await putDataUrl(id, dataUrl)
  } catch (e) {
    console.warn('[jan] 그림을 저장소에 담지 못해 문서 안에 그대로 둔다', e)
    return dataUrl
  }
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

/* 저장소에 알맹이가 없는 주소 — 다시 찾지 않는다.
   찾지 못한 주소를 그대로 두면 브라우저가 계속 그 주소를 부르고(ERR_UNKNOWN_URL_SCHEME),
   그때마다 다시 그려져 화면이 떨린다. 실제로 콘솔에 같은 요청이 7,000건 넘게 쌓였다. */
const missingRefs = new Set<string>()

/** 브라우저가 더는 부르지 않도록 놓아 두는 빈 그림 (1×1 투명) */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * 이미 풀어 둔 그림을 그 자리에서 곧바로 물린다 (기다리지 않는다).
 *
 * 크기를 바꾸면 그림 노드가 새로 그려지고 src 는 다시 1×1 빈 그림이 된다. 진짜 그림은
 * 저장소를 거쳐 물리므로 50ms 남짓 비어 있는데, 손잡이를 끄는 동안에는 그 일이 걸음마다
 * 되풀이되어 그림이 내내 안 보인 채로 크기만 바뀐다. 한 번 풀어 둔 주소는 이미 손에
 * 있으므로, 기다릴 것 없이 그 자리에서 물린다.
 *
 * @returns 아직 못 물린 것이 남았으면 true (그것만 저장소를 다녀와야 한다)
 */
function attachCached(root: ParentNode): boolean {
  let pending = false
  const elements = root.querySelectorAll<HTMLImageElement>(`img[data-blob-ref], img[src^="${REF_PREFIX}"]`)
  for (const element of Array.from(elements)) {
    const ref = element.getAttribute('data-blob-ref') || element.getAttribute('src') || ''
    if (!isBlobRef(ref)) continue
    const id = blobRefId(ref)
    if (missingRefs.has(id)) continue
    const url = objectUrls.get(id)
    if (!url) { pending = true; continue }
    if (element.getAttribute('src') !== url) element.src = url
  }
  return pending
}

export async function resolveBlobRefsInElement(root: ParentNode | null): Promise<void> {
  if (!root || !('querySelectorAll' in root)) return
  /* 그림은 src 에 빈 그림을 놓고 주소를 data-blob-ref 에 둔다 (브라우저가 못 읽는 주소를
     화면에 붙이면 붙을 때마다 부르고 실패한다). 옛 문서에는 src 에 그대로 있을 수 있으므로 둘 다 본다. */
  const elements = Array.from(root.querySelectorAll<HTMLImageElement | HTMLAudioElement | HTMLVideoElement>(
    `img[data-blob-ref], img[src^="${REF_PREFIX}"], audio[src^="${REF_PREFIX}"], video[src^="${REF_PREFIX}"]`,
  ))
  for (const element of elements) {
    const src = element.getAttribute('data-blob-ref') || element.getAttribute('src') || ''
    if (!isBlobRef(src)) continue
    const id = blobRefId(src)

    /* 없는 것으로 이미 판명된 주소는 다시 찾지 않는다 — 되풀이를 여기서 끊는다 */
    if (missingRefs.has(id)) { markMissing(element, id); continue }

    const url = await resolveBlobRefToObjectUrl(src)
    if (url) {
      /* 이미 물려 있으면 손대지 않는다.
         같은 값을 다시 넣어도 브라우저는 「고쳐졌다」 고 알리고, 이것을 지켜보던
         MutationObserver(watchBlobRefs)가 다시 깨어나 50ms 뒤 또 넣는다 — 끝이 없다.
         그 사이 편집기는 노드를 다시 그리며 src 를 1×1 빈 그림으로 되돌리므로
         그림이 1×1 과 제 크기 사이를 오가고, 그때마다 조판이 다시 돌아
         쪽 수가 뒤집히고 화면이 떨렸다. 그림이 끝내 자리를 잡지 못한 까닭이다. */
      if (element.getAttribute('src') !== url) element.src = url
      continue
    }

    /* 못 찾았다. 조용히 사라지게 두지 않는다 —
       무엇이 비었는지 보이게 하고, 브라우저가 그 주소를 다시 부르지 않게 한다. */
    missingRefs.add(id)
    markMissing(element, id)
  }
}

function markMissing(element: HTMLImageElement | HTMLAudioElement | HTMLVideoElement, id: string): void {
  if (element.getAttribute('data-jan-blob-missing') === id) return
  element.setAttribute('data-jan-blob-missing', id)
  element.setAttribute('title', '이 그림의 자료를 찾지 못했습니다 — 원본 파일(.jan)에서 다시 열면 되돌아옵니다')
  if (element.tagName === 'IMG') (element as HTMLImageElement).src = BLANK
  else element.removeAttribute('src')
}

/** 그림이 저장소에 다시 들어오면 잊는다 (다시 찾아볼 수 있게) */
export function forgetMissingBlobRef(ref: string): void {
  missingRefs.delete(blobRefId(ref))
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
    /* 앞의 일이 아직 안 끝났으면 버리지 말고 뒤로 미룬다.
       버리면 그때 들어온 그림은 아무도 다시 찾아 주지 않아 영영 빈 그림으로 남는다.
       예전에는 50ms 마다 헛도는 되풀이가 이것을 가려 주고 있었다. */
    if (running) { schedule(); return }
    running = true
    try { await resolveBlobRefsInElement(root) } catch { /* 못 바꾼 것은 다음 기회에 */ }
    finally { running = false }
  }
  const schedule = () => { if (timer === undefined) timer = window.setTimeout(run, 50) }

  const mo = new MutationObserver((records) => {
    for (const r of records) {
      let hit = r.type === 'attributes'
      if (!hit) {
        for (const n of Array.from(r.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element
          if (el.tagName === 'IMG' || el.querySelector?.('img, audio, video')) { hit = true; break }
        }
      }
      if (!hit) continue
      /* 아는 것부터 그 자리에서 물린다 — 기다리는 동안 그림이 비어 보이지 않게.
         모르는 것이 남았을 때만 저장소를 다녀온다. */
      if (attachCached(root)) schedule()
      return
    }
  })
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'data-blob-ref'] })
  void run()
  return () => {
    mo.disconnect()
    if (timer !== undefined) window.clearTimeout(timer)
  }
}
