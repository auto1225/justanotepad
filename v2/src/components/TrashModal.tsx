import { useEffect, useState } from 'react'
import { useMemosStore } from '../store/memosStore'
import { purgeMemoArtifacts } from '../lib/memoCleanup'
import { askConfirm } from '../lib/promptModal'
import { flash } from '../lib/flash'

interface TrashModalProps {
  onClose: () => void
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Phase 10 — 휴지통 모달.
 * 30일 보관 후 자동 정리. 복원 / 영구 삭제 / 전체 비우기.
 */
export function TrashModal({ onClose }: TrashModalProps) {
  const { trashedList, restore, permaDelete, emptyTrash } = useMemosStore()
  const items = trashedList()
  // 남은 보관일 계산 기준 시각 — 모달이 열린 순간으로 고정 (렌더 중 Date.now() 를 부르지 않는다)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function fmtRemain(trashedAt: number): string {
    const days = Math.max(0, Math.ceil((trashedAt + TTL_MS - now) / 86400000))
    return `${days}일 남음`
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-trash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>휴지통 ({items.length})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            삭제된 메모는 30일간 보관 후 자동 정리됩니다.
          </div>
          {items.length === 0 ? (
            <div className="jan-trash-empty">휴지통이 비어있습니다.</div>
          ) : (
            <>
              <ul className="jan-trash-list">
                {items.map((t) => (
                  <li key={t.id} className="jan-trash-item">
                    <div className="jan-trash-title">{t.title || '무제'}</div>
                    <div className="jan-trash-meta">
                      삭제: {new Date(t.trashedAt).toLocaleDateString('ko-KR')} · {fmtRemain(t.trashedAt)}
                    </div>
                    <div className="jan-trash-actions">
                      <button onClick={() => restore(t.id)}>복원</button>
                      <button
                        onClick={async () => {
                          if (await askConfirm('영구 삭제', `"${t.title || '무제'}" 메모를 영구 삭제합니다. 복구할 수 없습니다.`, '영구 삭제')) {
                            permaDelete(t.id); purgeMemoArtifacts([t.id]); flash('영구 삭제되었습니다')
                          }
                        }}
                      >
                        영구 삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                className="jan-trash-empty-btn"
                onClick={async () => {
                  if (await askConfirm('휴지통 비우기', `휴지통의 ${items.length}개 메모를 모두 영구 삭제합니다. 복구할 수 없습니다.`, '모두 삭제')) {
                    const ids = items.map((m) => m.id); emptyTrash(); purgeMemoArtifacts(ids); flash(`${ids.length}개 메모를 영구 삭제했습니다`)
                  }
                }}
              >
                휴지통 비우기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
