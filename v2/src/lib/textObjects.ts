import type { Editor } from '@tiptap/react'
import { flash } from './flash'

/**
 * 글자에 붙는 입력 것들을 다루는 손잡이 —
 * 드롭캡·덧말(루비)·강조점·글자 겹치기.
 * 리본·상황 메뉴·단축키가 모두 여기를 부른다.
 */

/* ── 드롭캡 ─────────────────────────────────────────── */

export function setDropCap(editor: Editor | null, lines: number | null): boolean {
  if (!editor) return false
  const ok = editor.chain().focus().updateAttributes('paragraph', { dropcap: lines ? String(lines) : null }).run()
  if (ok) flash(lines ? `첫 글자를 ${lines}줄 높이로 키웠다` : '첫 문자 장식을 없앴다')
  return ok
}

export function currentDropCap(editor: Editor | null): number {
  if (!editor) return 0
  return Number(editor.getAttributes('paragraph').dropcap) || 0
}

/* ── 덧말 (루비) ────────────────────────────────────── */

/** 고른 글자에 덧말을 붙인다 — 골라 둔 것이 없으면 물어본다 */
export function insertRuby(editor: Editor | null, base: string, note: string, pos: 'over' | 'under' = 'over'): boolean {
  if (!editor || !base || !note) return false
  const ok = editor.chain().focus().insertContent({ type: 'janRuby', attrs: { base, note, pos } }).run()
  if (ok) flash(`덧말을 ${pos === 'over' ? '위' : '아래'}에 달았다`)
  return ok
}

export function selectedText(editor: Editor | null): string {
  if (!editor) return ''
  const { from, to } = editor.state.selection
  return from === to ? '' : editor.state.doc.textBetween(from, to, ' ')
}

/* ── 강조점 ─────────────────────────────────────────── */

export function setEmphasis(editor: Editor | null, kind: string | null, pos: 'over' | 'under' = 'over'): boolean {
  if (!editor) return false
  if (!kind) {
    const ok = editor.chain().focus().unsetMark('janEmphasis').run()
    if (ok) flash('강조점을 없앴다')
    return ok
  }
  const ok = editor.chain().focus().setMark('janEmphasis', { kind, pos }).run()
  if (ok) flash('강조점을 찍었다')
  return ok
}

/* ── 글자 겹치기 ────────────────────────────────────── */

export function insertOverlap(editor: Editor | null, chars: string, frame = 'circle', scale = 100): boolean {
  if (!editor || !chars) return false
  const ok = editor.chain().focus().insertContent({
    type: 'janOverlap',
    attrs: { chars: chars.slice(0, 9), frame, scale: Math.min(150, Math.max(50, scale)) },
  }).run()
  if (ok) flash(`글자 ${chars.slice(0, 9).length}자를 겹쳤다`)
  return ok
}
