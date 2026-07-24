import { useMemo } from 'react'
import { useMemosStore } from '../store/memosStore'

interface ActivityHeatmapProps {
  onClose: () => void
}

/**
 * Phase 15 — GitHub 스타일 활동 히트맵.
 * 지난 365일 메모 작성/수정 빈도. 7×N 그리드.
 */
export function ActivityHeatmap({ onClose }: ActivityHeatmapProps) {
  const memos = useMemosStore((s) => s.memos)

  const data = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 364) // 365일 전
    start.setHours(0, 0, 0, 0)

    const buckets = new Map<string, number>()
    for (const m of Object.values(memos)) {
      const d = new Date(m.updatedAt)
      d.setHours(0, 0, 0, 0)
      if (d.getTime() < start.getTime() || d.getTime() > now.getTime()) continue
      const k = ymd(d)
      buckets.set(k, (buckets.get(k) || 0) + 1)
    }

    // 시작 요일 정렬 — 일요일 시작
    const startDay = start.getDay()
    const offset = startDay
    const days: Array<{ date: Date | null; key: string; count: number }> = []
    for (let i = 0; i < offset; i++) days.push({ date: null, key: 'pad' + i, count: 0 })

    const cur = new Date(start)
    while (cur.getTime() <= now.getTime()) {
      const k = ymd(cur)
      days.push({ date: new Date(cur), key: k, count: buckets.get(k) || 0 })
      cur.setDate(cur.getDate() + 1)
    }

    const maxCount = Math.max(1, ...Array.from(buckets.values()))
    const totalActiveDays = buckets.size
    const totalEvents = Array.from(buckets.values()).reduce((a, b) => a + b, 0)

    return { days, maxCount, totalActiveDays, totalEvents, startDate: start, endDate: now }
  }, [memos])

  function level(count: number, max: number): number {
    if (count === 0) return 0
    const r = count / max
    if (r < 0.25) return 1
    if (r < 0.5) return 2
    if (r < 0.75) return 3
    return 4
  }

  // 7 × N 그리드 — 일주일 단위 column
  const weeks: Array<typeof data.days> = []
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7))
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-heatmap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>활동 히트맵 — 지난 365일</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            활동일 <b>{data.totalActiveDays}일</b> · 총 변경 <b>{data.totalEvents}회</b> ·
            가장 활발 <b>{data.maxCount}회/일</b>
          </div>
          <div className="jan-heatmap-scroll">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={weeks.length * 13 + 30}
              height={7 * 13 + 24}
              style={{ display: 'block' }}
            >
              {weeks.map((w, wi) =>
                w.map((d, di) =>
                  d.date == null ? null : (
                    <rect
                      key={d.key}
                      x={wi * 13 + 30}
                      y={di * 13}
                      width={11}
                      height={11}
                      rx={2}
                      ry={2}
                      className={'jan-heat-cell jan-heat-l' + level(d.count, data.maxCount)}
                    >
                      <title>{ymd(d.date)} — {d.count}회 변경</title>
                    </rect>
                  )
                )
              )}
              {/* 요일 라벨 */}
              <text x={0} y={21} fontSize={10} fill="#888">월</text>
              <text x={0} y={47} fontSize={10} fill="#888">수</text>
              <text x={0} y={73} fontSize={10} fill="#888">금</text>
            </svg>
          </div>
          <div className="jan-heatmap-legend">
            <span>적게</span>
            <div className="jan-heat-cell jan-heat-l0" />
            <div className="jan-heat-cell jan-heat-l1" />
            <div className="jan-heat-cell jan-heat-l2" />
            <div className="jan-heat-cell jan-heat-l3" />
            <div className="jan-heat-cell jan-heat-l4" />
            <span>많이</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
