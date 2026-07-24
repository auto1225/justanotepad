import { useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useMemosStore } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'
import { useVersionsStore } from '../store/versionsStore'

interface InfoPanelProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 15 — 메모 정보 패널.
 * 우측 슬라이드 — 현재 메모의 메타정보 + 통계.
 */
const EMPTY_TAGS: string[] = []
const EMPTY_VERSIONS: never[] = []

export function InfoPanel({ editor, onClose }: InfoPanelProps) {
  const memo = useMemosStore((s) => s.current())
  // 셀렉터가 매번 새 배열([])을 만들면 useSyncExternalStore 가 무한 리렌더에 빠진다 —
  // 스토어의 원본 참조만 선택하고 빈 값은 모듈 상수로 대체
  const tags = useTagsStore((s) => (memo ? s.byMemo[memo.id] : undefined)) ?? EMPTY_TAGS
  const versions = useVersionsStore((s) => (memo ? s.byMemo[memo.id] : undefined)) ?? EMPTY_VERSIONS

  const stats = useMemo(() => {
    if (!editor) return { chars: 0, words: 0, paras: 0, headings: 0, links: 0, images: 0, tables: 0, readMin: 0 }
    const html = editor.getHTML()
    const div = document.createElement('div')
    div.innerHTML = html
    const text = (div.textContent || '').replace(/\s+/g, ' ').trim()
    const words = text ? text.split(/\s+/).length : 0
    const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length
    return {
      chars: text.length,
      words,
      paras: div.querySelectorAll('p').length,
      headings: div.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
      links: div.querySelectorAll('a').length,
      images: div.querySelectorAll('img').length,
      tables: div.querySelectorAll('table').length,
      readMin: Math.max(1, Math.round((words + koreanChars / 2) / 250)),
    }
  }, [editor, memo?.content])

  if (!memo) return null

  return (
    <div className="jan-info-panel">
      <div className="jan-info-head">
        <h3>메모 정보</h3>
        <button onClick={onClose}>×</button>
      </div>
      <div className="jan-info-body">
        <section>
          <h4>{memo.title || '무제'}</h4>
          <div className="jan-info-meta">
            생성: {new Date(memo.createdAt).toLocaleString('ko-KR')}<br />
            수정: {new Date(memo.updatedAt).toLocaleString('ko-KR')}
          </div>
        </section>

        <section>
          <h5>분량</h5>
          <div className="jan-info-grid">
            <Stat label="글자" v={stats.chars} />
            <Stat label="단어" v={stats.words} />
            <Stat label="단락" v={stats.paras} />
            <Stat label="제목" v={stats.headings} />
            <Stat label="링크" v={stats.links} />
            <Stat label="이미지" v={stats.images} />
            <Stat label="표" v={stats.tables} />
            <Stat label="읽기" v={stats.readMin + '분'} />
          </div>
        </section>

        <section>
          <h5>태그 ({tags.length})</h5>
          <div className="jan-info-tags">
            {tags.length === 0 ? <span className="jan-stats-empty">없음</span> : tags.map((t) => <span key={t} className="jan-tag">#{t}</span>)}
          </div>
        </section>

        <section>
          <h5>버전 히스토리 ({versions.length})</h5>
          <div className="jan-info-meta">
            {versions.length === 0 ? '아직 스냅샷이 없습니다.' : `최근: ${new Date(versions[0].takenAt).toLocaleString('ko-KR')}`}
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="jan-info-stat">
      <div className="jan-info-stat-v">{typeof v === 'number' ? v.toLocaleString() : v}</div>
      <div className="jan-info-stat-l">{label}</div>
    </div>
  )
}
