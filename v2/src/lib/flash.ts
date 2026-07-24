/**
 * 화면 중앙 하단에 잠깐 떠났다 사라지는 경량 피드백 토스트.
 * window.alert 대체용 — 흐름을 끊지 않고 결과만 알린다.
 */
let flashEl: HTMLDivElement | null = null
let flashTimer: number | null = null

export function flash(text: string, durationMs = 1600): void {
  if (typeof document === 'undefined') return
  if (!flashEl) {
    flashEl = document.createElement('div')
    flashEl.setAttribute('role', 'status')
    flashEl.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:48px', 'transform:translateX(-50%)',
      'background:rgba(30,30,30,0.92)', 'color:#fff', 'padding:8px 16px',
      'border-radius:8px', 'font-size:13px', 'z-index:99999', 'pointer-events:none',
      'transition:opacity 0.25s ease', 'max-width:70vw', 'text-align:center',
    ].join(';')
    document.body.appendChild(flashEl)
  }
  flashEl.textContent = text
  flashEl.style.opacity = '1'
  if (flashTimer) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    if (flashEl) flashEl.style.opacity = '0'
  }, durationMs)
}
