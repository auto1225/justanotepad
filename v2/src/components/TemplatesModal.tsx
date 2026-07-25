import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useTemplatesStore } from '../store/templatesStore'
import { flash } from '../lib/flash'
import { useMemosStore } from '../store/memosStore'
import { expandVars } from '../store/macrosStore'
import { getSavableHtml } from '../extensions/PageDocument'

interface TemplatesModalProps {
  editor?: Editor | null
  onClose: () => void
}

/**
 * Phase 16 — 사용자 메모 템플릿.
 * "현재 메모를 템플릿으로 저장" + "템플릿으로 새 메모 만들기".
 */
export function TemplatesModal({ editor, onClose }: TemplatesModalProps) {
  const { templates, add, remove, update } = useTemplatesStore()
  const memo = useMemosStore((s) => s.current())
  const newMemo = useMemosStore((s) => s.newMemo)
  const updateCurrent = useMemosStore((s) => s.updateCurrent)
  const setCurrent = useMemosStore((s) => s.setCurrent)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function saveCurrent() {
    if (!memo || !name.trim()) return
    const content = editor && !editor.isDestroyed ? getSavableHtml(editor) : memo.content
    if (editingId) {
      // 기존 템플릿 갱신 — 삭제 후 재저장하면 id 가 바뀌어 중복이 쌓인다
      update(editingId, { name: name.trim(), title: memo.title || '무제', content, category: category.trim() || undefined })
      setEditingId(null)
    } else {
      add({ name: name.trim(), title: memo.title || '무제', content, category: category.trim() || undefined })
    }
    setName('')
    setCategory('')
  }

  function applyTemplate(t: typeof templates[number]) {
    const id = newMemo()
    const expandedTitle = expandVars(t.title)
    const expandedContent = expandVars(t.content)
    updateCurrent({ title: expandedTitle, content: expandedContent })
    setCurrent(id)
    onClose()
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-templates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>메모 템플릿 ({templates.length})</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-settings-info">
            템플릿은 메모 1개 분량의 골조입니다. 변수 사용 가능: <code>{'{{date}}'}</code> <code>{'{{datetime}}'}</code>
          </div>

          <section className="jan-templates-section">
            <h4>현재 메모를 템플릿으로</h4>
            <div className="jan-macros-form">
              <input placeholder="템플릿 이름" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 2 }} />
              <input placeholder="카테고리 (선택)" value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }} />
              <button className="primary" onClick={saveCurrent} disabled={!memo || !name.trim()}>{editingId ? '갱신 저장' : '저장'}</button>
              {editingId && <button onClick={() => { setEditingId(null); setName(''); setCategory('') }}>취소</button>}
            </div>
          </section>

          <section className="jan-templates-section">
            <h4>저장된 템플릿</h4>
            {templates.length === 0 ? (
              <div className="jan-trash-empty">아직 저장된 템플릿이 없습니다.</div>
            ) : (
              <ul className="jan-templates-list">
                {templates.map((t) => (
                  <li key={t.id}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {t.category && `[${t.category}] `}
                        제목: {t.title} · {plainLen(t.content)}자
                      </div>
                    </div>
                    <span className="flex-spacer" />
                    <button onClick={() => applyTemplate(t)}>새 메모로</button>
                    <button
                      title="현재 메모 내용으로 이 템플릿을 즉시 갱신"
                      onClick={() => {
                        if (!memo) return
                        const content = editor && !editor.isDestroyed ? getSavableHtml(editor) : memo.content
                        update(t.id, { title: memo.title || '무제', content })
                        flash(`템플릿 "${t.name}" 을 현재 메모 내용으로 갱신했습니다`)
                      }}
                    >현재 메모로 갱신</button>
                    <button onClick={() => { if (confirm('삭제?')) remove(t.id) }}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function plainLen(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length
}
