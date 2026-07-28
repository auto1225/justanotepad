import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { flash } from './flash'

/**
 * 메모(주석)와 누름틀을 다루는 손잡이.
 * 워드의 「메모」와 한글의 「누름틀」을 같은 결로 묶어 두었다.
 */

export interface CommentRow {
  id: string
  text: string
  author: string
  at: string
  done: boolean
  from: number
  to: number
  quote: string
}

function newId(): string {
  return `c${Date.now().toString(36)}${Math.floor(performance.now() * 1000) % 4096}`
}

/** 고른 글에 메모를 단다 (워드의 Ctrl+Alt+M) */
export function addComment(editor: Editor | null, text: string, author = '나'): boolean {
  if (!editor || !text) return false
  const { from, to } = editor.state.selection
  if (from === to) { flash('메모를 달 글을 먼저 고른다'); return false }
  const ok = editor.chain().focus().setMark('janComment', {
    id: newId(),
    text,
    author,
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    done: false,
  }).run()
  if (ok) flash('메모를 달았다')
  return ok
}

/** 문서에 달린 메모를 놓인 차례대로 */
export function listComments(editor: Editor | null): CommentRow[] {
  if (!editor) return []
  const rows: CommentRow[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return
    const mark = node.marks.find((m) => m.type.name === 'janComment')
    if (!mark) return
    const id = String(mark.attrs.id || '')
    const last = rows[rows.length - 1]
    if (last && last.id === id) {
      last.to = pos + node.nodeSize
      last.quote += node.text || ''
      return
    }
    rows.push({
      id,
      text: String(mark.attrs.text || ''),
      author: String(mark.attrs.author || ''),
      at: String(mark.attrs.at || ''),
      done: !!mark.attrs.done,
      from: pos,
      to: pos + node.nodeSize,
      quote: node.text || '',
    })
  })
  return rows
}

/** 메모가 가리키는 자리로 간다 */
export function gotoComment(editor: Editor | null, row: CommentRow): boolean {
  if (!editor) return false
  editor.chain().focus().setTextSelection({ from: row.from, to: row.to }).scrollIntoView().run()
  return true
}

/** 메모 고치기·끝내기·지우기 — 같은 id 를 가진 자리를 모두 손본다 */
function eachComment(editor: Editor, id: string, fn: (from: number, to: number, attrs: Record<string, unknown>) => void) {
  const spots: { from: number; to: number; attrs: Record<string, unknown> }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return
    const mark = node.marks.find((m) => m.type.name === 'janComment' && m.attrs.id === id)
    if (mark) spots.push({ from: pos, to: pos + node.nodeSize, attrs: mark.attrs })
  })
  spots.reverse().forEach((s) => fn(s.from, s.to, s.attrs))
}

export function updateComment(editor: Editor | null, id: string, patch: Record<string, unknown>): boolean {
  if (!editor) return false
  const type = editor.schema.marks.janComment
  const tr = editor.state.tr
  eachComment(editor, id, (from, to, attrs) => {
    tr.removeMark(from, to, type)
    tr.addMark(from, to, type.create({ ...attrs, ...patch }))
  })
  editor.view.dispatch(tr)
  return true
}

export function toggleCommentDone(editor: Editor | null, row: CommentRow): boolean {
  const ok = updateComment(editor, row.id, { done: !row.done })
  if (ok) flash(row.done ? '메모를 다시 열었다' : '메모를 끝냈다')
  return ok
}

export function removeComment(editor: Editor | null, row: CommentRow): boolean {
  if (!editor) return false
  const type = editor.schema.marks.janComment
  const tr = editor.state.tr
  eachComment(editor, row.id, (from, to) => tr.removeMark(from, to, type))
  editor.view.dispatch(tr)
  flash('메모를 지웠다')
  return true
}

/* ── 누름틀 ───────────────────────────────────────────── */

export function insertField(editor: Editor | null, guide: string, memo = '', name = ''): boolean {
  if (!editor || !guide) return false
  const ok = editor.chain().focus().insertContent({ type: 'janField', attrs: { guide, memo, name, value: '' } }).run()
  if (ok) flash('누름틀을 넣었다 — 눌러서 채운다')
  return ok
}

export function currentField(editor: Editor | null): { pos: number; attrs: Record<string, unknown> } | null {
  if (!editor) return null
  const sel = editor.state.selection
  if (sel instanceof NodeSelection && sel.node.type.name === 'janField') {
    return { pos: sel.from, attrs: sel.node.attrs }
  }
  const after = editor.state.selection.$from.nodeAfter
  if (after?.type.name === 'janField') return { pos: editor.state.selection.from, attrs: after.attrs }
  return null
}

export function fillField(editor: Editor | null, pos: number, value: string): boolean {
  if (!editor) return false
  const node = editor.state.doc.nodeAt(pos)
  if (!node || node.type.name !== 'janField') return false
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value }))
  editor.view.focus()
  return true
}

/** 아직 안 채운 누름틀 자리들 */
export function emptyFields(editor: Editor | null): number[] {
  if (!editor) return []
  const out: number[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'janField' && !node.attrs.value) out.push(pos)
  })
  return out
}

/** 다음 누름틀로 건너뛴다 — 서식을 채워 나갈 때 쓴다 */
export function gotoNextField(editor: Editor | null): boolean {
  if (!editor) return false
  const spots: number[] = []
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'janField') spots.push(pos) })
  if (!spots.length) { flash('문서에 누름틀이 없다'); return false }
  const from = editor.state.selection.from
  const target = spots.find((p) => p > from) ?? spots[0]
  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target))
  tr.scrollIntoView()
  editor.view.dispatch(tr)
  editor.view.focus()
  return true
}
