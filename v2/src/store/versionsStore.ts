import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'
import { stripPageWrappers } from '../extensions/PageDocument'

/**
 * Phase 11 — 메모 자동 버전 히스토리.
 * 정책: 메모 별 최대 20개 스냅샷, 각 5분 이상 간격 또는 1KB 이상 변경 시.
 * 이전 버전으로 복원 가능.
 */
export interface Version {
  id: string
  memoId: string
  title: string
  content: string
  size: number
  takenAt: number
}

interface VersionsState {
  byMemo: Record<string, Version[]> // memoId → versions desc
  takeSnapshot: (memoId: string, title: string, content: string, opts?: { force?: boolean }) => void
  list: (memoId: string) => Version[]
  remove: (memoId: string, versionId: string) => void
  removeAll: (memoId: string) => void
}

const MIN_INTERVAL_MS = 5 * 60 * 1000 // 5분
const MIN_DIFF_BYTES = 1024 // 1KB
const MAX_PER_MEMO = 20

export const useVersionsStore = create<VersionsState>()(
  persist(
    (set, get) => ({
      byMemo: {},
      takeSnapshot: (memoId, title, rawContent, opts) => {
        // 어느 경로로 들어와도 용지 래퍼는 저장하지 않는다 (버전 복원 시 구조 오염 방지)
        const content = stripPageWrappers(rawContent)
        const list = get().byMemo[memoId] || []
        const last = list[0]
        const now = Date.now()
        if (last) {
          // 동일 내용이면 항상 skip
          if (last.content === content) return
          // force: 복원 직전처럼 반드시 백업이 필요한 경우 간격/크기 게이트를 건너뛴다
          if (!opts?.force) {
            const timeDiff = now - last.takenAt
            const sizeDiff = Math.abs(content.length - last.size)
            if (timeDiff < MIN_INTERVAL_MS && sizeDiff < MIN_DIFF_BYTES) return
          }
        }
        const v: Version = {
          id: 'v_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          memoId,
          title,
          content,
          size: content.length,
          takenAt: now,
        }
        const next = [v, ...list].slice(0, MAX_PER_MEMO)
        set((s) => ({ byMemo: { ...s.byMemo, [memoId]: next } }))
      },
      list: (memoId) => get().byMemo[memoId] || [],
      remove: (memoId, versionId) => {
        set((s) => ({
          byMemo: { ...s.byMemo, [memoId]: (s.byMemo[memoId] || []).filter((v) => v.id !== versionId) },
        }))
      },
      removeAll: (memoId) => {
        set((s) => {
          const next = { ...s.byMemo }
          delete next[memoId]
          return { byMemo: next }
        })
      },
    }),
    {
      name: 'jan-v2-versions',
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
