import { useCallback, useEffect, useState } from 'react'
import { pendingReopen, reopenSaved } from '../lib/postitWindow'

/**
 * 「지난번에 띄워 둔 포스트잇을 다시 띄울까」 — 앱을 켤 때 뜨는 작은 알림.
 *
 * 껐다 켜도 포스트잇이 그 자리에 있어야 한다. 그런데 브라우저는 사람이 누르지 않은
 * 창 띄우기를 막는다 (광고 창을 막기 위한 규칙이다). 그래서 알림 한 번을 두고,
 * 누르면 적어 둔 자리·크기로 되살린다. 앱으로 설치해 쓰면 이 알림도 곧 사라진다.
 */
export function PostitReopen() {
  const [count, setCount] = useState(0)
  const [hidden, setHidden] = useState(false)

  const look = useCallback(() => setCount(pendingReopen()), [])

  useEffect(() => {
    const first = window.setTimeout(look, 1200)   // 앱이 자리를 잡은 뒤에 살핀다
    window.addEventListener('jan-postit-changed', look)
    const t = window.setInterval(look, 4000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(t)
      window.removeEventListener('jan-postit-changed', look)
    }
  }, [look])

  if (hidden || count < 1) return null

  return (
    <div className="jan-postit-reopen" role="status">
      <span>지난번 포스트잇 {count}장</span>
      <button
        onClick={() => {
          reopenSaved(look)
          look()
        }}
      >다시 띄우기</button>
      <button onClick={() => setHidden(true)} aria-label="알림 닫기">×</button>
    </div>
  )
}
