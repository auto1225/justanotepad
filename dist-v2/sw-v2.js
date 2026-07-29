/**
 * Phase 7 — JustANotepad v2 Service Worker.
 * 정적 자산 cache-first, HTML stale-while-revalidate.
 * 오프라인에서도 v2 앱 동작.
 *
 * 캐시 키는 /v2/* 만 — v1 (/app, /home) 은 영향 X.
 */
const VERSION = 'jan-v2-sw-v23-janfile'
const STATIC_CACHE = `${VERSION}-static`

const PRECACHE = [
  '/v2/',
  '/v2/index.html',
  // 앱·문서 아이콘 — 설치와 파일 형식 표시에 쓰인다 (오프라인에서도 있어야 한다)
  '/v2/manifest.webmanifest',
  '/v2/icons/app-192.png',
  '/v2/icons/app-512.png',
  '/v2/icons/app-maskable-512.png',
  '/v2/icons/jan-file-256.png',
  '/v2/icons/jan-file-64.png',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('jan-v2-sw-') && !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  if (req.method !== 'GET') return
  // /v2/* 만 처리
  if (!url.pathname.startsWith('/v2/')) return
  // API endpoint 는 항상 네트워크
  if (url.pathname.startsWith('/v2/api/') || url.pathname === '/api/v2-ai') return

  // /v2/assets/* — 해시된 정적 자산: cache-first
  if (url.pathname.includes('/v2/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(req, clone)).catch(() => {})
            }
            return res
          }).catch(() => cached || new Response('offline', { status: 503 }))
      )
    )
    return
  }

  // /v2/ 또는 /v2/index.html — stale-while-revalidate
  if (url.pathname === '/v2/' || url.pathname === '/v2/index.html' || url.pathname === '/v2') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone)).catch(() => {})
          }
          return res
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'JAN_SKIP_WAITING') self.skipWaiting()
})
