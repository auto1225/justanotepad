import { describe, it, expect, beforeEach } from 'vitest'
import { useTagsStore } from './tagsStore'
import { useMemosStore, type Memo } from './memosStore'

function liveMemo(id: string): Memo {
  return { id, title: id, content: '', createdAt: 1, updatedAt: 1 }
}

beforeEach(() => {
  useTagsStore.setState({ byMemo: {} })
  // allTags 는 살아있는 메모의 태그만 센다 — 테스트 메모를 등록해 둔다
  useMemosStore.setState({
    memos: { m1: liveMemo('m1'), m2: liveMemo('m2'), m3: liveMemo('m3') },
  })
})

describe('tagsStore', () => {
  it('addTag normalizes case and #prefix', () => {
    useTagsStore.getState().addTag('m1', '#Important')
    useTagsStore.getState().addTag('m1', 'urgent')
    expect(useTagsStore.getState().byMemo['m1']).toEqual(['important', 'urgent'])
  })

  it('addTag prevents duplicates', () => {
    useTagsStore.getState().addTag('m1', 'work')
    useTagsStore.getState().addTag('m1', 'work')
    useTagsStore.getState().addTag('m1', 'WORK')
    expect(useTagsStore.getState().byMemo['m1']).toEqual(['work'])
  })

  it('removeTag', () => {
    useTagsStore.getState().setTags('m1', ['a', 'b', 'c'])
    useTagsStore.getState().removeTag('m1', 'b')
    expect(useTagsStore.getState().byMemo['m1']).toEqual(['a', 'c'])
  })

  it('allTags counts and sorts by frequency', () => {
    useTagsStore.getState().setTags('m1', ['common', 'rare'])
    useTagsStore.getState().setTags('m2', ['common'])
    useTagsStore.getState().setTags('m3', ['common'])
    const all = useTagsStore.getState().allTags()
    expect(all[0]).toEqual({ tag: 'common', count: 3 })
    expect(all[1]).toEqual({ tag: 'rare', count: 1 })
  })

  it('memosWithTag', () => {
    useTagsStore.getState().setTags('m1', ['x'])
    useTagsStore.getState().setTags('m2', ['x', 'y'])
    useTagsStore.getState().setTags('m3', ['y'])
    expect(useTagsStore.getState().memosWithTag('x').sort()).toEqual(['m1', 'm2'])
    expect(useTagsStore.getState().memosWithTag('y').sort()).toEqual(['m2', 'm3'])
  })

  it('addTag ignores empty', () => {
    useTagsStore.getState().addTag('m1', '   ')
    useTagsStore.getState().addTag('m1', '')
    expect(useTagsStore.getState().byMemo['m1']).toBeUndefined()
  })
})
