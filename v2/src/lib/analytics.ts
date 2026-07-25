/**
 * Phase 9 — 간단한 분석/로깅 래퍼.
 * 외부 서비스 (PostHog/Plausible 등) 의존 없음. 로컬 카운터.
 * 추후 환경변수 또는 settings 에서 외부 endpoint 추가 가능.
 */

const STORAGE = 'jan-v2-analytics'

interface AnalyticsState {
  events: Record<string, number>
  firstSeenAt: number
  lastEventAt: number
}

function load(): AnalyticsState {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE) || '{}')
    return {
      events: s.events || {},
      firstSeenAt: s.firstSeenAt || Date.now(),
      lastEventAt: s.lastEventAt || 0,
    }
  } catch {
    return { events: {}, firstSeenAt: Date.now(), lastEventAt: 0 }
  }
}
function save(s: AnalyticsState) {
  try { localStorage.setItem(STORAGE, JSON.stringify(s)) } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
}

/** 이벤트 카운터 증가 + 콘솔 로그 (DEV 모드만). */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  const s = load()
  s.events[name] = (s.events[name] || 0) + 1
  s.lastEventAt = Date.now()
  save(s)
  if (typeof process !== 'undefined' && (process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !== 'production') {
    console.log('[analytics]', name, props || '')
  }
}

export function getStats() {
  return load()
}

export function resetAnalytics() {
  save({ events: {}, firstSeenAt: Date.now(), lastEventAt: 0 })
}
