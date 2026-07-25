import { useState } from 'react'
import { useTagsStore } from '../store/tagsStore'
import { useMemosStore } from '../store/memosStore'
import { suggestTags } from '../lib/aiTagSuggest'
import { aiConfigured } from '../lib/aiApi'
import { errText } from '../lib/errText'

/**
 * Phase 6 — 현재 메모의 태그 표시·편집 + 태그 클릭 시 필터.
 * Toolbar 아래 한 줄.
 */
export function TagsBar() {
  const { byMemo, addTag, removeTag, allTags } = useTagsStore()
  const { currentId, memos, setCurrent } = useMemosStore()
  const [draft, setDraft] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const tags = (currentId && byMemo[currentId]) || []
  const all = allTags()

  function commit() {
    if (!currentId || !draft.trim()) return
    const parts = draft.split(/[\s,]+/).filter(Boolean)
    for (const p of parts) addTag(currentId, p)
    setDraft('')
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
  }

  async function suggest() {
    if (!currentId) return
    if (!aiConfigured()) {
      alert('설정에서 AI 키 또는 프록시를 활성화하세요.')
      return
    }
    const memo = memos[currentId]
    if (!memo) return
    try {
      const tags = await suggestTags(memo.content)
      tags.forEach((t) => addTag(currentId, t))
      if (tags.length === 0) alert('추천 태그가 없습니다.')
    } catch (e) {
      alert('AI 호출 실패: ' + errText(e))
    }
  }

  function jumpToFirst(tag: string) {
    const ids = Object.entries(byMemo).filter(([, t]) => t.includes(tag)).map(([id]) => id)
    if (ids[0] && memos[ids[0]]) {
      setCurrent(ids[0])
      setShowFilter(false)
    }
  }

  return (
    <div className="jan-tagsbar">
      <div className="jan-tagsbar-current">
        <span className="jan-tagsbar-label">태그:</span>
        {tags.length === 0 && <span className="jan-tagsbar-empty">(없음)</span>}
        {tags.map((t) => (
          <span key={t} className="jan-tag">
            #{t}
            <button onClick={() => currentId && removeTag(currentId, t)} title="삭제">×</button>
          </span>
        ))}
        <input
          className="jan-tagsbar-input"
          placeholder="태그 추가 (Enter 또는 쉼표로 구분)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
        <button className="jan-tagsbar-toggle" onClick={suggest} title="AI 가 추천하는 태그를 추가" style={{borderColor:'#D97757',color:'#D97757'}}>AI 추천</button>
        {all.length > 0 && (
          <button
            className="jan-tagsbar-toggle"
            onClick={() => setShowFilter((v) => !v)}
            title="모든 태그"
          >
            모든 태그 ({all.length})
          </button>
        )}
      </div>
      {showFilter && (
        <div className="jan-tagsbar-all">
          {all.map(({ tag, count }) => (
            <button
              key={tag}
              className="jan-tag jan-tag-clickable"
              onClick={() => jumpToFirst(tag)}
              title={`'${tag}' 태그가 있는 메모로 이동`}
            >
              #{tag} ({count})
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
