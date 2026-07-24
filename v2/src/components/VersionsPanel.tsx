import { useState } from 'react'
import { useMemosStore } from '../store/memosStore'
import { useVersionsStore } from '../store/versionsStore'

interface VersionsPanelProps {
  onClose: () => void
}

/**
 * Phase 11 — 버전 히스토리 패널.
 * 현재 메모의 자동 스냅샷 목록 + 내용 미리보기 + 복원.
 */
export function VersionsPanel({ onClose }: VersionsPanelProps) {
  const memo = useMemosStore((s) => s.current())
  const updateCurrent = useMemosStore((s) => s.updateCurrent)
  const list = useVersionsStore((s) => s.list)
  const remove = useVersionsStore((s) => s.remove)
  const removeAll = useVersionsStore((s) => s.removeAll)
  const takeSnapshot = useVersionsStore((s) => s.takeSnapshot)
  const versions = memo ? list(memo.id) : []
  const [selected, setSelected] = useState(versions[0]?.id || '')

  const sel = versions.find((v) => v.id === selected) || versions[0]

  function previewText(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800)
  }

  function restore(versionContent: string, versionTitle: string) {
    if (!confirm('현재 메모를 이 버전으로 복원할까요? 현재 내용은 새 버전으로 자동 저장됩니다.')) return
    // 안내문 그대로 — 덮어쓰기 전에 현재 내용을 강제 스냅샷 (마지막 자동 스냅샷 이후의
    // 편집이 복원으로 사라지는 데이터 유실 방지)
    if (memo) takeSnapshot(memo.id, memo.title, memo.content, { force: true })
    updateCurrent({ title: versionTitle, content: versionContent })
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-versions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>버전 히스토리 ({versions.length})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body jan-versions-body">
          <aside className="jan-versions-list">
            {versions.length === 0 && <div className="jan-versions-empty">버전이 없습니다.</div>}
            {versions.map((v) => (
              <button
                key={v.id}
                className={'jan-versions-item' + (v.id === selected ? ' is-active' : '')}
                onClick={() => setSelected(v.id)}
              >
                <div className="jan-versions-time">{new Date(v.takenAt).toLocaleString('ko-KR')}</div>
                <div className="jan-versions-size">{v.size}자 · {v.title || '무제'}</div>
              </button>
            ))}
            {memo && versions.length > 0 && (
              <button
                className="jan-versions-clear"
                onClick={() => {
                  if (confirm('이 메모의 모든 버전을 삭제할까요?')) removeAll(memo.id)
                }}
              >
                전체 삭제
              </button>
            )}
          </aside>
          <section className="jan-versions-preview">
            {sel ? (
              <>
                <div className="jan-versions-meta">
                  <b>{sel.title || '무제'}</b> · {new Date(sel.takenAt).toLocaleString('ko-KR')}
                </div>
                <div className="jan-versions-text">{previewText(sel.content) || '(빈 내용)'}</div>
                <div className="jan-versions-actions">
                  <button onClick={() => restore(sel.content, sel.title)}>이 버전으로 복원</button>
                  <button onClick={() => memo && remove(memo.id, sel.id)}>이 버전 삭제</button>
                </div>
              </>
            ) : (
              <div className="jan-versions-empty">버전을 선택하세요.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
