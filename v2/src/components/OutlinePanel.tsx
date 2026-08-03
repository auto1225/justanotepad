import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { outlineLevelOf } from '../lib/docStyles'

interface OutlinePanelProps {
  editor: Editor | null
}

interface Heading {
  level: number
  text: string
  pos: number
}

/**
 * Phase 6 — 문서 자동 목차 (TOC).
 * 사이드바에 H1~H6 트리. 클릭 → 해당 위치로 스크롤.
 * Word 탐색 창에 맞춰 제목 검색, 현재 위치 강조, 실제 문서 위치 점프를 제공한다.
 */
export function OutlinePanel({ editor }: OutlinePanelProps) {
  const [filter, setFilter] = useState('')
  const editorState = useEditorStateSnapshot(editor)
  const headings = useMemo(() => (
    editorState ? collectHeadings(editorState.doc) : []
  ), [editorState])
  const activePos = useMemo(() => {
    if (!editorState || headings.length === 0) return null
    const cursor = editorState.selection.from
    let active: number | null = null
    for (const heading of headings) {
      if (heading.pos <= cursor) active = heading.pos
      else break
    }
    return active
  }, [editorState, headings])
  const filteredHeadings = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase('ko-KR')
    if (!query) return headings
    return headings.filter((heading) => heading.text.toLocaleLowerCase('ko-KR').includes(query))
  }, [filter, headings])

  function jump(pos: number) {
    if (!editor) return
    editor.chain().focus().setTextSelection({ from: pos + 1, to: pos + 1 }).scrollIntoView().run()
  }

  if (!editor) return null

  return (
    <div className="jan-outline">
      <div className="jan-outline-head">
        <span>목차</span>
        <small>{headings.length}</small>
      </div>
      <div className="jan-outline-search">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="제목 검색"
          aria-label="목차 제목 검색"
        />
      </div>
      {headings.length === 0 && <div className="jan-outline-empty">제목이 없습니다.</div>}
      {headings.length > 0 && filteredHeadings.length === 0 && (
        <div className="jan-outline-empty">일치하는 제목이 없습니다.</div>
      )}
      <ul className="jan-outline-list">
        {filteredHeadings.map((h) => (
          <li key={h.pos}>
            <button
              type="button"
              className={'jan-outline-item lvl' + h.level + (activePos === h.pos ? ' is-active' : '')}
              style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
              onClick={() => jump(h.pos)}
              title={h.text}
            >
              <span className="jan-outline-level">H{h.level}</span>
              <span className="jan-outline-text">{h.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function useEditorStateSnapshot(editor: Editor | null): EditorState | null {
  const subscribe = useCallback((emit: () => void) => {
    if (!editor) return () => {}
    editor.on('update', emit)
    editor.on('selectionUpdate', emit)
    return () => {
      editor.off('update', emit)
      editor.off('selectionUpdate', emit)
    }
  }, [editor])

  const getSnapshot = useCallback(() => editor?.state ?? null, [editor])

  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

function collectHeadings(doc: ProseMirrorNode): Heading[] {
  const list: Heading[] = []
  doc.descendants((node, pos) => {
    /* 태그(h1~h6)가 아니라 개요 수준으로 모은다 — 스타일로 「제목1」 을 붙인 문단도
       제목이고, h1 에 「바탕글」 을 붙였으면 제목이 아니다 (워드와 같은 차례). */
    const level = outlineLevelOf(node)
    if (level > 0) {
      list.push({ level, text: node.textContent || '(빈 제목)', pos })
    }
    return true
  })
  return list
}
