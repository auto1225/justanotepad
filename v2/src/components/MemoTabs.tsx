import { useEffect, useState } from 'react'
import { useMemosStore } from '../store/memosStore'
import { Icon } from './Icons'

const OPEN_TABS_KEY = 'jan-v2-open-tabs'

/**
 * Phase 19 — v1 스타일 메모 탭 바.
 * 사용자가 사이드바에서 클릭한 메모들이 탭으로 추가됨.
 * 탭 X → 닫기. + → 새 메모. 활성 탭 강조.
 */
export function MemoTabs() {
  const { memos, currentId, setCurrent, newMemo } = useMemosStore()
  const [openIds, setOpenIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(OPEN_TABS_KEY) || '[]')
      // 과거 버전에서 중복이 영속화됐을 수 있으므로 로드 시 정리
      return Array.isArray(parsed) ? [...new Set(parsed as string[])] : []
    } catch { return [] }
  })

  // currentId 가 openIds 에 없으면 추가.
  // 중복 검사는 함수형 업데이트 안에서 해야 StrictMode 이중 실행·경합에도 안전하다.
  useEffect(() => {
    if (currentId && memos[currentId]) {
      setOpenIds((ids) => (ids.includes(currentId) ? ids : [...ids, currentId]))
    }
  }, [currentId, memos])

  // openIds 영속
  useEffect(() => {
    try { localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(openIds)) } catch {}
  }, [openIds])

  // 닫힌 메모 (휴지통 등) 정리
  useEffect(() => {
    setOpenIds((ids) => {
      const next = ids.filter((id) => memos[id])
      // 내용이 같으면 기존 배열을 반환해 불필요한 재렌더/localStorage 쓰기를 막는다
      return next.length === ids.length ? ids : next
    })
  }, [memos])

  function close(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenIds((ids) => {
      const next = ids.filter((x) => x !== id)
      // 닫는 탭이 활성 탭이면 인접 탭으로 이동
      if (id === currentId && next.length > 0) {
        const idx = ids.indexOf(id)
        const newCur = next[Math.min(idx, next.length - 1)]
        setCurrent(newCur)
      }
      return next
    })
  }

  if (openIds.length === 0) return null

  // 색상 dot — id 의 hash 로 일관된 색
  function dotColor(id: string): string {
    const colors = ['#D97757', '#5D4037', '#1976D2', '#388E3C', '#FBC02D', '#E91E63', '#7B1FA2', '#00838F']
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return colors[h % colors.length]
  }

  return (
    <div className="jan-memo-tabs">
      {openIds.map((id) => {
        const m = memos[id]
        if (!m) return null
        const active = id === currentId
        return (
          <div
            key={id}
            className={'jan-memo-tab' + (active ? ' is-active' : '')}
            onClick={() => setCurrent(id)}
            onAuxClick={(e) => { if (e.button === 1) close(id, e) }}
            title={m.title || '무제'}
          >
            <span className="jan-memo-tab-dot" style={{ background: dotColor(id) }} />
            <span className="jan-memo-tab-title">{m.title || '무제'}</span>
            <button
              className="jan-memo-tab-close"
              onClick={(e) => close(id, e)}
              aria-label="탭 닫기"
            >
              <Icon name="close" size={11} />
            </button>
          </div>
        )
      })}
      <button
        className="jan-memo-tab-new"
        onClick={() => newMemo()}
        title="새 메모"
        aria-label="새 메모"
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}
