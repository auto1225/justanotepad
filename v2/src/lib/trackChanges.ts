import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { flash } from './flash'
import { trackAuthor, setTrackAuthor } from '../extensions/TrackChanges'

/**
 * 변경 내용 다루기 — 워드 「검토 › 변경 내용」.
 *
 * 표시를 모아 보고(검토 창), 하나씩 또는 한꺼번에 적용·되돌리고, 앞뒤로 건너뛴다.
 * 손보는 명령은 모두 janTrack 표를 달아 둔다 — 그러지 않으면 추적기가
 * 「적용하려고 지운 글」을 또 지움 표시로 되살려 버린다.
 */

export type TrackKind = 'ins' | 'del'
export type TrackMode = 'all' | 'final' | 'orig'

export interface TrackRow {
  kind: TrackKind
  author: string
  at: string
  text: string
  from: number
  to: number
}

const MODE_KEY = 'jan-v2-track-mode'
const ON_KEY = 'jan-v2-track-on'

export { trackAuthor, setTrackAuthor }

/* ── 켜고 끄기 ────────────────────────────────────────── */

export function trackingOn(editor: Editor | null): boolean {
  if (!editor) return false
  return !!(editor.storage as unknown as Record<string, { on?: boolean }>).janTrack?.on
}

export function setTracking(editor: Editor | null, on: boolean): boolean {
  if (!editor) return false
  const store = (editor.storage as unknown as Record<string, { on: boolean }>).janTrack
  if (!store) return false
  store.on = on
  try { localStorage.setItem(ON_KEY, on ? '1' : '0') } catch { /* 저장 못 해도 이번 판은 쓴다 */ }
  document.documentElement.dataset.janTracking = on ? 'on' : 'off'
  window.dispatchEvent(new Event('jan-track-changed'))
  flash(on ? '변경 내용 추적을 켰다 — 고친 자리가 남는다' : '변경 내용 추적을 껐다')
  return true
}

export function toggleTracking(editor: Editor | null): boolean {
  return setTracking(editor, !trackingOn(editor))
}

/* ── 표시 방식 (모든 수정 / 최종본 / 원본) ─────────────── */

export const TRACK_MODES: { key: TrackMode; label: string; hint: string }[] = [
  { key: 'all', label: '모든 수정 내용', hint: '넣은 글은 밑줄, 지운 글은 줄을 그어 함께 보인다' },
  { key: 'final', label: '고친 뒤 모습', hint: '지운 글을 감춘다 — 다 받아들인 모습' },
  { key: 'orig', label: '고치기 전 모습', hint: '넣은 글을 감춘다 — 원래 문서' },
]

export function trackMode(): TrackMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'final' || v === 'orig') return v
  } catch { /* 못 읽으면 다 보여 준다 */ }
  return 'all'
}

export function setTrackMode(mode: TrackMode) {
  try { localStorage.setItem(MODE_KEY, mode) } catch { /* 무시 */ }
  document.documentElement.dataset.janTrack = mode
  window.dispatchEvent(new Event('jan-track-changed'))
  flash('표시: ' + (TRACK_MODES.find((m) => m.key === mode)?.label || mode))
}

/** 앱이 뜰 때 지난번 상태를 화면에 되살린다 */
export function applyTrackView(editor: Editor | null) {
  document.documentElement.dataset.janTrack = trackMode()
  document.documentElement.dataset.janTracking = trackingOn(editor) ? 'on' : 'off'
}

/* ── 모아 보기 ────────────────────────────────────────── */

/** 문서에 남은 변경 표시를 놓인 차례대로 — 이어진 같은 표시는 한 줄로 묶는다 */
export function listChanges(editor: Editor | null): TrackRow[] {
  if (!editor) return []
  const rows: TrackRow[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isInline) return
    const mark = node.marks.find((m) => m.type.name === 'janIns' || m.type.name === 'janDel')
    if (!mark) return
    const kind: TrackKind = mark.type.name === 'janIns' ? 'ins' : 'del'
    const author = String(mark.attrs.author || '')
    const text = node.isText ? (node.text || '') : '〔' + node.type.name + '〕'
    const last = rows[rows.length - 1]
    if (last && last.kind === kind && last.author === author && last.to === pos) {
      last.to = pos + node.nodeSize
      last.text += text
      return
    }
    rows.push({ kind, author, at: String(mark.attrs.at || ''), text, from: pos, to: pos + node.nodeSize })
  })
  return rows
}

export function changeCount(editor: Editor | null): { ins: number; del: number } {
  const rows = listChanges(editor)
  return { ins: rows.filter((r) => r.kind === 'ins').length, del: rows.filter((r) => r.kind === 'del').length }
}

/* ── 적용 · 되돌리기 ──────────────────────────────────── */

function markType(editor: Editor, kind: TrackKind) {
  return kind === 'ins' ? editor.schema.marks.janIns : editor.schema.marks.janDel
}

/** 이 자리의 변경을 받아들인다 — 넣은 글은 표시만 벗기고, 지운 글은 정말로 지운다 */
export function acceptChange(editor: Editor | null, row: TrackRow): boolean {
  if (!editor) return false
  const tr = editor.state.tr
  tr.setMeta('janTrack', 'manual')
  if (row.kind === 'ins') tr.removeMark(row.from, row.to, markType(editor, 'ins'))
  else tr.delete(row.from, row.to)
  editor.view.dispatch(tr)
  return true
}

/** 이 자리의 변경을 되돌린다 — 넣은 글은 지우고, 지운 글은 되살린다 */
export function rejectChange(editor: Editor | null, row: TrackRow): boolean {
  if (!editor) return false
  const tr = editor.state.tr
  tr.setMeta('janTrack', 'manual')
  if (row.kind === 'ins') tr.delete(row.from, row.to)
  else tr.removeMark(row.from, row.to, markType(editor, 'del'))
  editor.view.dispatch(tr)
  return true
}

/** 모두 한꺼번에 — 뒤에서부터 손대야 앞자리 좌표가 흔들리지 않는다 */
function applyAll(editor: Editor | null, accept: boolean, only?: TrackKind): number {
  if (!editor) return 0
  const rows = listChanges(editor).filter((r) => !only || r.kind === only)
  if (!rows.length) return 0
  const tr = editor.state.tr
  tr.setMeta('janTrack', 'manual')
  rows.slice().reverse().forEach((row) => {
    const kill = accept ? row.kind === 'del' : row.kind === 'ins'
    if (kill) tr.delete(row.from, row.to)
    else tr.removeMark(row.from, row.to, markType(editor, row.kind))
  })
  editor.view.dispatch(tr)
  return rows.length
}

export function acceptAll(editor: Editor | null, only?: TrackKind): number {
  const n = applyAll(editor, true, only)
  flash(n ? `변경 ${n}건을 적용했다` : '적용할 변경이 없다')
  return n
}

export function rejectAll(editor: Editor | null, only?: TrackKind): number {
  const n = applyAll(editor, false, only)
  flash(n ? `변경 ${n}건을 되돌렸다` : '되돌릴 변경이 없다')
  return n
}

/* ── 건너뛰기 ────────────────────────────────────────── */

export function gotoChange(editor: Editor | null, dir: 1 | -1): TrackRow | null {
  if (!editor) return null
  const rows = listChanges(editor)
  if (!rows.length) { flash('문서에 변경 표시가 없다'); return null }
  const here = editor.state.selection.from
  const next = dir > 0
    ? rows.find((r) => r.from > here) ?? rows[0]
    : [...rows].reverse().find((r) => r.to < here) ?? rows[rows.length - 1]
  editor.chain().focus().setTextSelection({ from: next.from, to: next.to }).scrollIntoView().run()
  flash(`${next.kind === 'ins' ? '넣음' : '지움'} · ${next.author || '누군가'} — ${next.text.slice(0, 20)}`)
  return next
}

/** 이 자리에 걸린 변경 (적용·되돌리기 단추가 무엇을 손댈지 알려 준다) */
export function changeAtCursor(editor: Editor | null): TrackRow | null {
  if (!editor) return null
  const here = editor.state.selection.from
  return listChanges(editor).find((r) => r.from <= here && here <= r.to) ?? null
}

/** 커서 자리 변경을 적용·되돌린다 (없으면 다음 것으로 옮겨 준다) */
export function applyHere(editor: Editor | null, accept: boolean): boolean {
  if (!editor) return false
  const row = changeAtCursor(editor) ?? gotoChange(editor, 1)
  if (!row) return false
  const ok = accept ? acceptChange(editor, row) : rejectChange(editor, row)
  if (!ok) return false
  flash(accept ? '이 변경을 적용했다' : '이 변경을 되돌렸다')
  /* 이어서 다음 변경을 보여 준다 — 워드처럼 계속 눌러 나갈 수 있게 */
  if (listChanges(editor).length) {
    const at = Math.max(1, Math.min(row.from, editor.state.doc.content.size - 1))
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)))
    gotoChange(editor, 1)
  }
  return true
}
