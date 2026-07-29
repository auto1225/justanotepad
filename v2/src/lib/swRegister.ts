/**
 * Service Worker 등록 + 자동 업데이트.
 *
 * 설치해서 쓰는 앱(PWA)은 며칠씩 열어 두는 일이 흔하다.
 * 예전에는 새 판이 올라와도 사용자가 스스로 새로 고쳐야 반영됐고,
 * 그 사이 예전 화면이 새 서버에 없는 조각을 찾다 실패하기도 했다.
 * 그래서 (1) 새 판이 있는지 스스로 살피고, (2) 방해되지 않는 때에 스스로 갈아탄다.
 */
import { flash } from './flash'

/** 새 판이 있는지 살피는 주기 — 앱을 오래 열어 두는 사람을 위한 것이다 */
const CHECK_EVERY_MS = 30 * 60 * 1000
/** 사람이 손을 뗀 뒤 이만큼 조용하면 갈아탄다 (타자 중에 새로 고치면 안 된다) */
const IDLE_BEFORE_RELOAD_MS = 20 * 1000

export function registerV2ServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (location.hostname === 'localhost' && location.protocol !== 'https:') {
    // 로컬 개발 모드 — SW 비활성
    return
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/v2/sw-v2.js', { scope: '/v2/' })
      .then((reg) => {
        watchForUpdate(reg)
        keepChecking(reg)
      })
      .catch((e) => console.warn('[SW v2] register failed', e))

    // 새 일꾼이 자리를 넘겨받으면 화면도 새 판으로 맞춘다 (한 번만)
    let switching = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (switching) return
      switching = true
      reloadWhenQuiet()
    })
  })
}

/**
 * 배포 직후, 열어 둔 예전 화면이 새 서버에 없는 조각을 찾다 실패하는 일을 막는다.
 * (필요할 때 불러오는 화면 — 설정·미리보기 따위 — 이 그때 안 열렸다)
 * 그런 실패는 곧 "판이 바뀌었다"는 뜻이니, 한 번만 조용히 새로 고친다.
 */
export function recoverFromStaleChunks(reload: () => void = () => location.reload()) {
  let once = false
  const bounce = () => {
    if (once) return
    once = true
    reloadWhenQuiet({ reload, notify: false })
  }
  window.addEventListener('vite:preloadError', bounce)
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason as Error)?.message || e.reason || '')
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) bounce()
  })
}

/** 새 판이 설치되면 곧바로 자리를 내주게 한다 */
function watchForUpdate(reg: ServiceWorkerRegistration) {
  const take = (worker: ServiceWorker | null) => {
    if (!worker) return
    const ask = () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        worker.postMessage({ type: 'JAN_SKIP_WAITING' })
      }
    }
    ask() // 이미 기다리고 있던 새 판도 놓치지 않는다
    worker.addEventListener('statechange', ask)
  }
  take(reg.waiting)
  reg.addEventListener('updatefound', () => take(reg.installing))
}

/** 오래 열어 두어도 새 판을 놓치지 않게 — 주기적으로, 창으로 돌아올 때, 연결이 살아날 때 살핀다 */
function keepChecking(reg: ServiceWorkerRegistration) {
  const check = () => { reg.update().catch(() => { /* 네트워크가 없으면 다음 기회에 */ }) }
  window.setInterval(check, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('online', check)
}

/**
 * 새로 고칠 때를 고른다 — 글을 쓰는 중에 화면이 바뀌면 안 된다.
 * 창을 보고 있지 않으면 그 자리에서, 보고 있으면 손을 뗀 뒤 조용해질 때.
 * (쓰던 글은 pagehide 에서 이미 저장된다)
 */
export function reloadWhenQuiet(opts: { reload?: () => void; idleMs?: number; notify?: boolean } = {}) {
  const reload = opts.reload ?? (() => location.reload())
  const idleMs = opts.idleMs ?? IDLE_BEFORE_RELOAD_MS
  if (document.visibilityState === 'hidden') { reload(); return }

  if (opts.notify !== false) flash('새 버전이 준비됐습니다 — 잠시 뒤 자동으로 반영됩니다', 3200)
  let timer = 0
  let done = false
  const go = () => { if (done) return; done = true; window.clearTimeout(timer); reload() }
  const arm = () => {
    if (done) return
    window.clearTimeout(timer)
    timer = window.setTimeout(go, idleMs)
  }
  const busy: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'wheel', 'touchstart']
  busy.forEach((type) => window.addEventListener(type, arm, { passive: true }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') go() // 창을 떠난 순간이 가장 안전하다
  })
  arm()
}
