import { afterEach, describe, expect, it, vi } from 'vitest'
import { recoverFromStaleChunks, reloadWhenQuiet } from './swRegister'

/**
 * 설치해 쓰는 앱의 자동 업데이트 — 언제 새로 고칠지가 전부다.
 * 글 쓰는 중에 화면이 갈아엎이면 안 되고, 손을 떼면 알아서 반영돼야 한다.
 */
describe('새 판으로 갈아타는 때', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('창을 보고 있지 않으면 그 자리에서 새로 고친다', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const reload = vi.fn()
    reloadWhenQuiet({ reload })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('보고 있으면 곧장 고치지 않고, 조용해진 뒤에 고친다', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const reload = vi.fn()

    reloadWhenQuiet({ reload, idleMs: 1000, notify: false })
    expect(reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(900)
    window.dispatchEvent(new Event('keydown')) // 아직 타자 중이다 — 기다린다
    vi.advanceTimersByTime(900)
    expect(reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('두 번 새로 고치지 않는다', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const reload = vi.fn()
    reloadWhenQuiet({ reload, idleMs: 500, notify: false })
    vi.advanceTimersByTime(2000)
    vi.advanceTimersByTime(2000)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('배포 뒤 예전 화면이 없는 조각을 찾으면 한 번만 스스로 고친다', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const reload = vi.fn()
    recoverFromStaleChunks(reload)

    window.dispatchEvent(new Event('vite:preloadError'))
    window.dispatchEvent(new Event('vite:preloadError'))
    vi.advanceTimersByTime(60_000)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
