/**
 * Same-origin tab sync.
 *
 * v2 now persists memo data through IndexedDB-backed local-first storage.
 * BroadcastChannel therefore carries the latest memo payload directly so a
 * second tab does not race an async IndexedDB write.
 */
import { useMemosStore } from '../store/memosStore'
import { readPersistedJson } from './localFirstStorage'

const CHANNEL = 'jan-v2-sync'

type MemosPayload = Pick<ReturnType<typeof useMemosStore.getState>, 'memos' | 'trashed' | 'currentId' | 'order' | 'sortMode'>

interface SyncMessage {
  type: 'memos-changed' | 'theme-changed' | 'settings-changed'
  ts: number
  origin: string
  memos?: MemosPayload
}

let channel: BroadcastChannel | null = null
const ORIGIN_ID = 'tab_' + Math.random().toString(36).slice(2, 10)
let suppressBroadcast = false

/**
 * 다른 탭의 스냅샷을 통째로 덮어쓰지 않고 메모별 updatedAt 기준으로 병합한다.
 * - 두 탭이 서로 다른 메모를 동시에 편집해도 어느 쪽 편집도 잃지 않는다.
 * - currentId 는 항상 이 탭 것을 유지 (다른 탭이 보고 있는 메모로 끌려가지 않음).
 * - 다른 탭에서 휴지통으로 보낸/복원한 메모는 타임스탬프가 더 최신일 때만 따라간다.
 */
export function mergeIncomingMemos(
  local: MemosPayload,
  incoming: MemosPayload,
): Pick<MemosPayload, 'memos' | 'trashed' | 'order' | 'sortMode'> {
  const memos = { ...local.memos }
  const trashed = { ...local.trashed }

  for (const [id, memo] of Object.entries(incoming.memos || {})) {
    const mine = memos[id]
    const myTrashed = trashed[id]
    // 이 탭에서 휴지통에 있는데 상대 탭 사본이 더 최신이면 복원으로 간주
    if (myTrashed && (memo.updatedAt || 0) > (myTrashed.trashedAt || myTrashed.updatedAt || 0)) {
      delete trashed[id]
      memos[id] = memo
      continue
    }
    if (myTrashed) continue // 로컬 삭제가 더 최신 → 유지
    if (!mine || (memo.updatedAt || 0) >= (mine.updatedAt || 0)) memos[id] = memo
  }

  for (const [id, item] of Object.entries(incoming.trashed || {})) {
    const mine = memos[id]
    // 상대 탭에서 삭제됨 — 로컬 사본이 삭제 이후에 편집된 게 아니면 따라서 삭제
    if (mine && (item.trashedAt || 0) >= (mine.updatedAt || 0)) {
      delete memos[id]
      trashed[id] = item
    } else if (!mine && !trashed[id]) {
      trashed[id] = item
    }
  }

  const order = [...local.order]
  for (const id of incoming.order || []) {
    if (!order.includes(id) && memos[id]) order.push(id)
  }

  return { memos, trashed, order: order.filter((id) => memos[id]), sortMode: incoming.sortMode || local.sortMode }
}

export function startMultiTabSync() {
  if (typeof BroadcastChannel === 'undefined') return
  if (channel) return
  channel = new BroadcastChannel(CHANNEL)

  channel.addEventListener('message', async (e: MessageEvent<SyncMessage>) => {
    if (e.data.origin === ORIGIN_ID) return
    if (e.data.type !== 'memos-changed') return

    try {
      const data = e.data.memos || (await readPersistedJson<MemosPayload>('jan:v2:memos'))?.state
      if (!data) return
      suppressBroadcast = true
      useMemosStore.setState(mergeIncomingMemos(useMemosStore.getState(), data))
      suppressBroadcast = false
    } catch {
      suppressBroadcast = false
    }
  })

  useMemosStore.subscribe((state) => {
    if (suppressBroadcast) return
    channel?.postMessage({
      type: 'memos-changed',
      ts: Date.now(),
      origin: ORIGIN_ID,
      memos: {
        memos: state.memos,
        trashed: state.trashed,
        currentId: state.currentId,
        order: state.order,
        sortMode: state.sortMode,
      },
    } as SyncMessage)
  })
}

export function stopMultiTabSync() {
  channel?.close()
  channel = null
}
