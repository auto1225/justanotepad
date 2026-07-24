import { describe, expect, it } from 'vitest'
import { mergeIncomingMemos } from './multiTabSync'
import type { Memo, TrashedMemo } from '../store/memosStore'

function memo(id: string, updatedAt: number, content = ''): Memo {
  return { id, title: id, content, createdAt: 1, updatedAt }
}

function trashedMemo(id: string, updatedAt: number, trashedAt: number): TrashedMemo {
  return { ...memo(id, updatedAt), trashedAt }
}

function payload(over: Partial<Parameters<typeof mergeIncomingMemos>[0]> = {}) {
  return {
    memos: {},
    trashed: {},
    currentId: null,
    order: [],
    sortMode: 'recent' as const,
    ...over,
  }
}

describe('mergeIncomingMemos', () => {
  it('서로 다른 메모를 동시에 편집해도 양쪽 편집을 모두 보존한다', () => {
    const local = payload({
      memos: { a: memo('a', 200, 'A-new'), b: memo('b', 50, 'B-old') },
      order: ['a', 'b'],
    })
    const incoming = payload({
      memos: { a: memo('a', 100, 'A-old'), b: memo('b', 150, 'B-new') },
      order: ['a', 'b'],
    })
    const merged = mergeIncomingMemos(local, incoming)
    expect(merged.memos.a.content).toBe('A-new')
    expect(merged.memos.b.content).toBe('B-new')
  })

  it('currentId 를 반환하지 않아 이 탭의 선택이 유지된다', () => {
    const merged = mergeIncomingMemos(payload(), payload({ currentId: 'other' }))
    expect('currentId' in merged).toBe(false)
  })

  it('상대 탭의 삭제는 로컬 사본이 그 이후 편집되지 않았을 때만 따라간다', () => {
    const local = payload({ memos: { a: memo('a', 100), b: memo('b', 300) }, order: ['a', 'b'] })
    const incoming = payload({
      trashed: { a: trashedMemo('a', 100, 200), b: trashedMemo('b', 100, 200) },
    })
    const merged = mergeIncomingMemos(local, incoming)
    expect(merged.memos.a).toBeUndefined()
    expect(merged.trashed.a).toBeDefined()
    // b 는 삭제(200) 이후 로컬에서 편집(300)됨 → 살아남는다
    expect(merged.memos.b).toBeDefined()
  })

  it('상대 탭에서 복원한 메모는 휴지통보다 최신일 때 로컬에서도 복원된다', () => {
    const local = payload({ trashed: { a: trashedMemo('a', 100, 150) } })
    const incoming = payload({ memos: { a: memo('a', 200, 'restored') }, order: ['a'] })
    const merged = mergeIncomingMemos(local, incoming)
    expect(merged.memos.a?.content).toBe('restored')
    expect(merged.trashed.a).toBeUndefined()
  })

  it('상대 탭에만 있는 새 메모는 order 뒤에 추가된다', () => {
    const local = payload({ memos: { a: memo('a', 100) }, order: ['a'] })
    const incoming = payload({ memos: { a: memo('a', 100), c: memo('c', 100) }, order: ['c', 'a'] })
    const merged = mergeIncomingMemos(local, incoming)
    expect(merged.order).toEqual(['a', 'c'])
  })
})
