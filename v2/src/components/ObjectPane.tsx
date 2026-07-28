import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

interface ObjectRow {
  pos: number
  kind: string
  label: string
  locked: boolean
}

const KIND_NAMES: Record<string, string> = {
  image: '그림',
  janShape: '도형',
  table: '표',
  janRuby: '덧말',
  janOverlap: '겹친 글자',
  mathInline: '수식',
  mermaid: '다이어그램',
}

/**
 * 개체 목록 — 워드의 「선택 창(Alt+F10)」, 한글의 「조판 부호 보기」 자리.
 *
 * 겹쳐 놓여 마우스로 집기 어려운 개체도 여기서 고르면 잡힌다.
 * 목록은 문서에 놓인 차례 그대로다. ↑↓ 로 옮겨 다니고 Enter 로 고른다.
 */
export function ObjectPane({ editor, onClose }: Props) {
  const [rows, setRows] = useState<ObjectRow[]>([])

  const scan = useCallback(() => {
    if (!editor) return
    const out: ObjectRow[] = []
    editor.state.doc.descendants((node, pos) => {
      const name = node.type.name
      if (!KIND_NAMES[name]) return
      let label: string
      if (name === 'image') label = String(node.attrs.caption || node.attrs.alt || node.attrs.src || '').slice(0, 40)
      else if (name === 'janShape') label = String(node.attrs.text || node.attrs.caption || node.attrs.shape || '')
      else if (name === 'table') label = `${node.childCount}줄`
      else label = node.textContent.slice(0, 30) || String(node.attrs.chars || node.attrs.latex || '')
      out.push({ pos, kind: name, label, locked: !!node.attrs.locked })
      if (name === 'table') return false
    })
    setRows(out)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    // 처음 한 번은 다음 그림틀에서 훑는다 (그리는 도중에 상태를 건드리지 않게)
    const first = window.requestAnimationFrame(scan)
    editor.on('update', scan)
    editor.on('selectionUpdate', scan)
    return () => {
      window.cancelAnimationFrame(first)
      editor.off('update', scan)
      editor.off('selectionUpdate', scan)
    }
  }, [editor, scan])

  if (!editor) return null

  const pick = (row: ObjectRow) => {
    try {
      const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, row.pos))
      tr.scrollIntoView()
      editor.view.dispatch(tr)
      editor.view.focus()
    } catch {
      editor.chain().focus(row.pos + 1).run()
    }
  }

  const toggleLock = (row: ObjectRow) => {
    const node = editor.state.doc.nodeAt(row.pos)
    if (!node || !('locked' in node.attrs)) { flash('이 개체는 잠글 수 없다'); return }
    editor.view.dispatch(editor.state.tr.setNodeMarkup(row.pos, undefined, { ...node.attrs, locked: !node.attrs.locked }))
    scan()
  }

  const remove = (row: ObjectRow) => {
    const node = editor.state.doc.nodeAt(row.pos)
    if (!node) return
    editor.view.dispatch(editor.state.tr.delete(row.pos, row.pos + node.nodeSize))
    scan()
  }

  function onKey(e: React.KeyboardEvent) {
    const buttons = [...document.querySelectorAll('.jan-objpane-row > button:first-child')] as HTMLButtonElement[]
    if (!buttons.length) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); buttons[Math.min(buttons.length - 1, i + 1)]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[Math.max(0, i - 1)]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); editor?.commands.focus() }
  }

  return (
    <div className="jan-objpane" role="dialog" aria-label="개체 목록" onKeyDown={onKey}>
      <div className="jan-objpane-head">
        <strong>개체 목록</strong>
        <span className="jan-objpane-count">{rows.length}</span>
        <button onClick={onClose} aria-label="개체 목록 닫기">닫기</button>
      </div>
      {rows.length === 0 ? (
        <p className="jan-objpane-empty">문서에 그림·도형·표가 아직 없다.</p>
      ) : (
        <ul className="jan-objpane-list">
          {rows.map((row) => (
            <li key={row.pos} className="jan-objpane-row">
              <button onClick={() => pick(row)} title="이 개체를 고른다">
                <span className="jan-objpane-kind">{KIND_NAMES[row.kind]}</span>
                <span className="jan-objpane-label">{row.label || '이름 없음'}</span>
              </button>
              <button onClick={() => toggleLock(row)} title={row.locked ? '개체 보호 풀기' : '개체 보호'} aria-label={row.locked ? '개체 보호 풀기' : '개체 보호'}>
                {row.locked ? '잠김' : '열림'}
              </button>
              <button onClick={() => remove(row)} title="지우기" aria-label="개체 지우기">×</button>
            </li>
          ))}
        </ul>
      )}
      <p className="jan-objpane-hint">↑↓ 로 옮겨 다니고 Enter 로 고른다 · Alt+F10 으로 여닫는다</p>
    </div>
  )
}
