/**
 * Phase 8 — 모달 focus trap.
 * Tab/Shift+Tab 키로 모달 안의 focusable 요소만 순환.
 * 모달 닫기 시 직전 focus 복원.
 */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function trapFocus(container: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null

  function getFocusables(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute('aria-hidden'))
  }

  // 모달 열렸을 때 첫 번째 focusable 로 이동
  setTimeout(() => {
    const focusables = getFocusables()
    if (focusables.length > 0) focusables[0].focus()
  }, 30)

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const focusables = getFocusables()
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  container.addEventListener('keydown', onKey)
  return () => {
    container.removeEventListener('keydown', onKey)
    if (previouslyFocused && document.contains(previouslyFocused)) {
      try { previouslyFocused.focus() } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
    }
  }
}

/** React hook 형태 — useEffect 안에서 호출 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  if (typeof window === 'undefined') return
  if (!active || !ref.current) return
  return trapFocus(ref.current)
}
