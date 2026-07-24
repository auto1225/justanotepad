import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'
import { useMemosStore } from './memosStore'

/**
 * Phase 6 — 태그 시스템.
 * memoId → string[] 매핑. 메모 별로 0~N 태그.
 */
interface TagsState {
  byMemo: Record<string, string[]>
  addTag: (memoId: string, tag: string) => void
  removeTag: (memoId: string, tag: string) => void
  setTags: (memoId: string, tags: string[]) => void
  /** 모든 메모 통틀어 사용된 태그 unique 목록 (사용 빈도 내림차순). */
  allTags: () => Array<{ tag: string; count: number }>
  /** 태그를 가진 메모 ID 목록. */
  memosWithTag: (tag: string) => string[]
}

export const useTagsStore = create<TagsState>()(
  persist(
    (set, get) => ({
      byMemo: {},
      addTag: (memoId, tag) => {
        const t = tag.trim().replace(/^#/, '').toLowerCase()
        if (!t) return
        set((s) => {
          const cur = s.byMemo[memoId] || []
          if (cur.includes(t)) return s
          return { byMemo: { ...s.byMemo, [memoId]: [...cur, t] } }
        })
      },
      removeTag: (memoId, tag) =>
        set((s) => {
          const cur = s.byMemo[memoId] || []
          return { byMemo: { ...s.byMemo, [memoId]: cur.filter((x) => x !== tag) } }
        }),
      setTags: (memoId, tags) =>
        set((s) => ({ byMemo: { ...s.byMemo, [memoId]: tags.map((t) => t.toLowerCase()) } })),
      allTags: () => {
        // 휴지통에 있거나 삭제된 메모의 태그는 세지 않는다 (유령 태그 방지)
        const liveMemos = useMemosStore.getState().memos
        const counts = new Map<string, number>()
        for (const [memoId, tags] of Object.entries(get().byMemo)) {
          if (!liveMemos[memoId]) continue
          for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1)
        }
        return Array.from(counts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      },
      memosWithTag: (tag) => {
        const t = tag.toLowerCase()
        return Object.entries(get().byMemo)
          .filter(([, tags]) => tags.includes(t))
          .map(([id]) => id)
      },
    }),
    {
      name: 'jan-v2-tags',
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
