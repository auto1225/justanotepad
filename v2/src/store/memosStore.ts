import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createLocalFirstStorage } from '../lib/localFirstStorage'
import { DEFAULT_MEMO_PAGE_SETTINGS, normalizeMemoPageSettings, sameMemoPageSettings, type MemoPageSettings } from './uiStore'

export type SortMode = 'recent' | 'title' | 'created' | 'manual'

export interface MemoSummary {
  id: string
  title: string
  updatedAt: number
  pinned?: boolean
  preview?: string
}

export interface Memo {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  pageSettings?: MemoPageSettings
}

export interface TrashedMemo extends Memo {
  trashedAt: number
}

interface MemosState {
  memos: Record<string, Memo>
  trashed: Record<string, TrashedMemo>
  currentId: string | null
  order: string[]
  sortMode: SortMode

  newMemo: () => string
  setCurrent: (id: string) => void
  updateMemo: (id: string, patch: { title?: string; content?: string; pageSettings?: MemoPageSettings }) => void
  updateCurrent: (patch: { title?: string; content?: string; pageSettings?: MemoPageSettings }) => void
  updateMemoPageSettings: (id: string, pageSettings: MemoPageSettings) => void
  togglePin: (id: string) => void
  duplicate: (id: string) => string | null
  deleteMemo: (id: string) => void // → 휴지통으로
  restore: (id: string) => void
  permaDelete: (id: string) => void
  emptyTrash: () => void
  purgeOldTrash: () => void // 30일 지난 것 자동 정리
  setSortMode: (m: SortMode) => void
  reorder: (fromId: string, toId: string) => void
  list: () => MemoSummary[]
  trashedList: () => TrashedMemo[]
  current: () => Memo | null
}

function makeId(): string {
  return 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function makeBlankMemo(): Memo {
  const now = Date.now()
  return {
    id: makeId(),
    title: '새 메모',
    content: '<p></p>',
    createdAt: now,
    updatedAt: now,
    pageSettings: DEFAULT_MEMO_PAGE_SETTINGS,
  }
}

function makePreview(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 80)
}

const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30일

export const useMemosStore = create<MemosState>()(
  persist(
    (set, get) => ({
      memos: {},
      trashed: {},
      currentId: null,
      order: [],
      sortMode: 'recent',

      newMemo: () => {
        const memo = makeBlankMemo()
        set((s) => ({
          memos: { ...s.memos, [memo.id]: memo },
          currentId: memo.id,
          order: [memo.id, ...s.order],
        }))
        return memo.id
      },

      setCurrent: (id) => {
        if (get().memos[id]) set({ currentId: id })
      },

      updateMemo: (id, patch) => {
        set((s) => {
          const cur = s.memos[id]
          if (!cur) return s
          const next: Memo = {
            ...cur,
            ...patch,
            pageSettings: patch.pageSettings ? normalizeMemoPageSettings(patch.pageSettings) : cur.pageSettings,
            updatedAt: Date.now(),
          }
          // 수동(드래그) 정렬에서는 편집이 배열 순서를 건드리면 안 된다 — 타이핑 한 번에 배치가 무너진다
          const newOrder = s.sortMode === 'manual' ? s.order : [id, ...s.order.filter((memoId) => memoId !== id)]
          return { memos: { ...s.memos, [id]: next }, order: newOrder }
        })
      },

      updateCurrent: (patch) => {
        set((s) => {
          if (!s.currentId) return s
          const cur = s.memos[s.currentId]
          if (!cur) return s
          const next: Memo = {
            ...cur,
            ...patch,
            pageSettings: patch.pageSettings ? normalizeMemoPageSettings(patch.pageSettings) : cur.pageSettings,
            updatedAt: Date.now(),
          }
          const newOrder = s.sortMode === 'manual' ? s.order : [s.currentId, ...s.order.filter((id) => id !== s.currentId)]
          return { memos: { ...s.memos, [s.currentId]: next }, order: newOrder }
        })
      },

      updateMemoPageSettings: (id, pageSettings) => {
        set((s) => {
          const cur = s.memos[id]
          if (!cur) return s
          const nextPageSettings = normalizeMemoPageSettings(pageSettings)
          if (sameMemoPageSettings(cur.pageSettings, nextPageSettings)) return s
          const next: Memo = { ...cur, pageSettings: nextPageSettings, updatedAt: Date.now() }
          const newOrder = s.sortMode === 'manual' ? s.order : [id, ...s.order.filter((memoId) => memoId !== id)]
          return { memos: { ...s.memos, [id]: next }, order: newOrder }
        })
      },

      togglePin: (id) => {
        set((s) => {
          const m = s.memos[id]
          if (!m) return s
          return { memos: { ...s.memos, [id]: { ...m, pinned: !m.pinned } } }
        })
      },

      duplicate: (id) => {
        const s = get()
        const src = s.memos[id]
        if (!src) return null
        const now = Date.now()
        const copy: Memo = {
          ...src,
          id: makeId(),
          title: src.title + ' (복사본)',
          createdAt: now,
          updatedAt: now,
          pinned: false,
          pageSettings: normalizeMemoPageSettings(src.pageSettings),
        }
        set((st) => ({
          memos: { ...st.memos, [copy.id]: copy },
          order: [copy.id, ...st.order],
          currentId: copy.id,
        }))
        return copy.id
      },

      deleteMemo: (id) => {
        set((s) => {
          const m = s.memos[id]
          if (!m) return s
          const newMemos = { ...s.memos }
          delete newMemos[id]
          const newOrder = s.order.filter((x) => x !== id)
          const newCurrent = s.currentId === id ? newOrder[0] || null : s.currentId
          const newTrashed = { ...s.trashed, [id]: { ...m, trashedAt: Date.now() } as TrashedMemo }
          if (newOrder.length === 0) {
            const blank = makeBlankMemo()
            return {
              memos: { [blank.id]: blank },
              order: [blank.id],
              currentId: blank.id,
              trashed: newTrashed,
            }
          }
          return { memos: newMemos, order: newOrder, currentId: newCurrent, trashed: newTrashed }
        })
      },

      restore: (id) => {
        set((s) => {
          const t = s.trashed[id]
          if (!t) return s
          const newTrashed = { ...s.trashed }
          delete newTrashed[id]
          const { trashedAt: _trashedAt, ...rest } = t
          void _trashedAt
          const restored: Memo = { ...rest, updatedAt: Date.now() }
          return {
            memos: { ...s.memos, [id]: restored },
            order: [id, ...s.order.filter((x) => x !== id)],
            trashed: newTrashed,
          }
        })
      },

      permaDelete: (id) => {
        set((s) => {
          const newTrashed = { ...s.trashed }
          delete newTrashed[id]
          return { trashed: newTrashed }
        })
      },

      emptyTrash: () => set({ trashed: {} }),

      purgeOldTrash: () => {
        const now = Date.now()
        const purged: string[] = []
        set((s) => {
          const next: Record<string, TrashedMemo> = {}
          for (const [id, t] of Object.entries(s.trashed)) {
            if (now - t.trashedAt < TRASH_TTL_MS) next[id] = t
            else purged.push(id)
          }
          return { trashed: next }
        })
        // 태그·워크스페이스·버전·첨부 잔재도 함께 정리 (순환 import 방지를 위해 동적 로드)
        if (purged.length) void import('../lib/memoCleanup').then((m) => m.purgeMemoArtifacts(purged))
      },

      setSortMode: (m) => set({ sortMode: m }),

      reorder: (fromId, toId) => {
        set((s) => {
          const arr = [...s.order]
          const fi = arr.indexOf(fromId), ti = arr.indexOf(toId)
          if (fi < 0 || ti < 0 || fi === ti) return s
          arr.splice(fi, 1)
          arr.splice(ti, 0, fromId)
          return { order: arr, sortMode: 'manual' as const }
        })
      },

      list: () => {
        const s = get()
        const summaries: MemoSummary[] = s.order
          .map((id) => s.memos[id])
          .filter(Boolean)
          .map((m) => ({
            id: m.id,
            title: m.title,
            updatedAt: m.updatedAt,
            pinned: !!m.pinned,
            preview: makePreview(m.content),
          }))

        // 정렬: 핀 → sortMode
        const cmp = (() => {
          switch (s.sortMode) {
            case 'title':
              return (a: MemoSummary, b: MemoSummary) => a.title.localeCompare(b.title)
            case 'created':
              return (a: MemoSummary, b: MemoSummary) => {
                const am = s.memos[a.id]
                const bm = s.memos[b.id]
                return (bm?.createdAt || 0) - (am?.createdAt || 0)
              }
            case 'manual':
              return () => 0 // 핀 정렬만, 나머지 order 유지
            default: // recent
              return (a: MemoSummary, b: MemoSummary) => b.updatedAt - a.updatedAt
          }
        })()
        summaries.sort((a, b) => {
          if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
          return cmp(a, b)
        })
        return summaries
      },

      trashedList: () => {
        const s = get()
        return Object.values(s.trashed).sort((a, b) => b.trashedAt - a.trashedAt)
      },

      current: () => {
        const s = get()
        return s.currentId ? s.memos[s.currentId] : null
      },
    }),
    {
      name: 'jan:v2:memos',
      version: 2,
      storage: createJSONStorage(() => createLocalFirstStorage()),
    }
  )
)
