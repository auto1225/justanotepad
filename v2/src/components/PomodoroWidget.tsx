import { useEffect, useRef, useState } from 'react'

/**
 * Phase 14 — 뽀모도로 타이머 위젯.
 * 25분 작업 / 5분 휴식 (4세트 후 15분 긴 휴식).
 * StatusBar 옆 또는 floating 버튼으로 표시 가능.
 */
type Phase = 'work' | 'break' | 'long-break'

const DURATIONS: Record<Phase, number> = {
  work: 25 * 60,
  break: 5 * 60,
  'long-break': 15 * 60,
}

export function PomodoroWidget() {
  const [phase, setPhase] = useState<Phase>('work')
  const [remaining, setRemaining] = useState(DURATIONS.work)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            // 타이머 종료 — 다음 페이즈
            const newCompleted = phase === 'work' ? completed + 1 : completed
            setCompleted(newCompleted)
            const next: Phase = phase === 'work'
              ? newCompleted % 4 === 0 ? 'long-break' : 'break'
              : 'work'
            setPhase(next)
            // 알림
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('JustANotepad 뽀모도로', {
                body: phase === 'work' ? '집중 시간 끝! 휴식하세요.' : '휴식 끝! 다시 집중!',
              })
            }
            // 비프음
            try {
              const ctx = new AudioContext()
              const o = ctx.createOscillator()
              o.frequency.value = 800
              o.connect(ctx.destination)
              o.start()
              setTimeout(() => { o.stop(); ctx.close() }, 200)
            } catch { /* 실패해도 진행 — 부가 기능이라 무시한다 */ }
            return DURATIONS[next]
          }
          return r - 1
        })
      }, 1000)
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [running, phase, completed])

  function toggle() {
    if (!running && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    setRunning((r) => !r)
  }

  function reset() {
    setRunning(false)
    setRemaining(DURATIONS[phase])
  }

  function setTo(p: Phase) {
    setPhase(p)
    setRemaining(DURATIONS[p])
    setRunning(false)
  }

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0')
  const ss = (remaining % 60).toString().padStart(2, '0')
  const phaseLabel = { work: '집중', break: '휴식', 'long-break': '긴 휴식' }[phase]
  const color = phase === 'work' ? '#D32F2F' : '#2E7D32'

  return (
    <>
      <button
        className="jan-pomodoro-trigger"
        onClick={() => setOpen((v) => !v)}
        title="뽀모도로 타이머"
        style={{ color: running ? color : undefined }}
      >
        ● {mm}:{ss}
      </button>
      {open && (
        <div className="jan-pomodoro-panel" style={{ borderTop: `3px solid ${color}` }}>
          <div className="jan-pomodoro-phase">{phaseLabel} · 완료 {completed}회</div>
          <div className="jan-pomodoro-time" style={{ color }}>{mm}:{ss}</div>
          <div className="jan-pomodoro-actions">
            <button onClick={toggle} className="jan-pomodoro-toggle" style={{ background: color }}>
              {running ? '일시정지' : '시작'}
            </button>
            <button onClick={reset}>리셋</button>
          </div>
          <div className="jan-pomodoro-tabs">
            <button onClick={() => setTo('work')} className={phase === 'work' ? 'is-active' : ''}>집중 25분</button>
            <button onClick={() => setTo('break')} className={phase === 'break' ? 'is-active' : ''}>휴식 5분</button>
            <button onClick={() => setTo('long-break')} className={phase === 'long-break' ? 'is-active' : ''}>긴 휴식 15분</button>
          </div>
        </div>
      )}
    </>
  )
}
