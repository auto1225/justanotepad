import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useSnippetsStore } from '../store/snippetsStore'

interface SnippetsModalProps {
  editor: Editor | null
  onClose: () => void
}

/**
 * Phase 14 — 스니펫 모달.
 * 좌측 카테고리/목록 + 우측 미리보기 + 삽입/편집/삭제.
 */
export function SnippetsModal({ editor, onClose }: SnippetsModalProps) {
  const { snippets, add, remove, update } = useSnippetsStore()
  const [selected, setSelected] = useState(snippets[0]?.id || '')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')

  const sel = snippets.find((s) => s.id === selected)

  function insert(c: string) {
    if (!editor) return
    editor.chain().focus().insertContent(c).run()
    onClose()
  }

  function commit() {
    if (!name.trim() || !content.trim()) return
    if (editingId) {
      // 수정 — 삭제 후 재추가하면 id 가 바뀌어 중복이 쌓이므로 update 로 교체
      update(editingId, { name: name.trim(), category: category.trim() || undefined, content })
    } else {
      add({ name: name.trim(), category: category.trim() || undefined, content })
    }
    setName(''); setCategory(''); setContent(''); setCreating(false); setEditingId(null)
  }

  function startEdit() {
    if (!sel) return
    setName(sel.name)
    setCategory(sel.category || '')
    setContent(sel.content)
    setEditingId(sel.id)
    setCreating(true)
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-snippets-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>스니펫 ({snippets.length})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body" style={{ display: 'flex', gap: 0, padding: 0 }}>
          <aside className="jan-snippets-list">
            {snippets.map((s) => (
              <button
                key={s.id}
                className={'jan-snippets-item' + (s.id === selected ? ' is-active' : '')}
                onClick={() => { setSelected(s.id); setCreating(false); setEditingId(null) }}
              >
                <div className="jan-snippets-name">{s.name}</div>
                {s.category && <div className="jan-snippets-cat">{s.category}</div>}
              </button>
            ))}
            <button className="jan-snippets-new" onClick={() => { setCreating(true); setEditingId(null); setName(''); setCategory(''); setContent('') }}>
              + 새 스니펫
            </button>
          </aside>
          <section className="jan-snippets-preview">
            {creating ? (
              <>
                <input
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: 6, marginBottom: 6, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <input
                  placeholder="카테고리 (선택)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: 6, marginBottom: 6, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <textarea
                  placeholder="HTML 또는 텍스트"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button onClick={commit} style={{ background: '#D97757', color: '#fff', border: 0, padding: '6px 14px', borderRadius: 4, cursor: 'pointer' }}>
                    {editingId ? '저장' : '추가'}
                  </button>
                  <button onClick={() => { setCreating(false); setEditingId(null) }}>취소</button>
                </div>
              </>
            ) : sel ? (
              <>
                <div className="jan-snippets-meta">
                  <b>{sel.name}</b>
                  {sel.category && ` · ${sel.category}`}
                </div>
                <div
                  className="jan-snippets-render"
                  dangerouslySetInnerHTML={{ __html: sel.content }}
                />
                <details className="jan-snippets-source">
                  <summary>HTML 소스 보기</summary>
                  <pre>{sel.content}</pre>
                </details>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button
                    onClick={() => insert(sel.content)}
                    style={{ background: '#D97757', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    메모에 삽입
                  </button>
                  <button onClick={startEdit}>수정</button>
                  <button onClick={() => { if (confirm('삭제?')) remove(sel.id) }}>
                    삭제
                  </button>
                </div>
              </>
            ) : (
              <div className="jan-versions-empty">스니펫을 선택하세요.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
