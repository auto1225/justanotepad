import type { Editor } from '@tiptap/react'
import { flash } from './flash'

/**
 * 워드 「홈」 탭에 있는데 우리에게 없던 것들 —
 * 클립보드(붙여넣기 갈래) · 글꼴(대소문자·밑줄 모양·문자 테두리/음영) ·
 * 단락(줄 간격·단락 앞뒤 공백·목록 모양·단락 음영/테두리) · 편집(선택 갈래).
 */

/* ── 클립보드 ───────────────────────────────────────── */

export type PasteMode = 'keep' | 'merge' | 'text'

/**
 * 붙여넣기 갈래 — 워드의 「붙여넣기 옵션」.
 *  keep  원본 서식 유지 · merge 서식 병합(글자 서식만 지금 문단에 맞춤) · text 텍스트만
 */
export async function pasteAs(editor: Editor, mode: PasteMode): Promise<boolean> {
  try {
    if (mode === 'text') {
      const text = await navigator.clipboard.readText()
      if (!text) { flash('클립보드가 비어 있다'); return false }
      editor.chain().focus().insertContent(text.replace(/\r\n/g, '\n')).run()
      flash('텍스트만 붙였다')
      return true
    }
    const items = await navigator.clipboard.read()
    let html = ''
    for (const item of items) {
      if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
    }
    if (!html) {
      const text = await navigator.clipboard.readText()
      if (!text) { flash('클립보드가 비어 있다'); return false }
      editor.chain().focus().insertContent(text).run()
      return true
    }
    if (mode === 'merge') {
      // 서식 병합 — 글자 꾸밈만 남기고 문단 서식(정렬·들여쓰기)은 지금 문단을 따른다
      html = html
        .replace(/\sstyle="[^"]*"/gi, (m) => (/(font-weight|font-style|text-decoration|color)/i.test(m) ? m : ''))
        .replace(/<(h[1-6]|blockquote)[^>]*>/gi, '<p>')
        .replace(/<\/(h[1-6]|blockquote)>/gi, '</p>')
    }
    editor.chain().focus().insertContent(html).run()
    flash(mode === 'keep' ? '원본 서식을 유지해 붙였다' : '서식을 지금 문단에 맞춰 붙였다')
    return true
  } catch {
    flash('브라우저가 클립보드 읽기를 막았다 — Ctrl+V 로 붙여 넣어라')
    return false
  }
}

/* ── 글꼴 ───────────────────────────────────────────── */

export type CaseMode = 'sentence' | 'lower' | 'upper' | 'capitalize' | 'toggle'

/** 대/소문자 바꾸기 — 워드의 「Aa」 (한글은 그대로 둔다) */
export function changeCase(editor: Editor, mode: CaseMode): boolean {
  const { from, to } = editor.state.selection
  if (from === to) { flash('바꿀 글을 먼저 고른다'); return false }
  const text = editor.state.doc.textBetween(from, to, ' ')
  const out =
    mode === 'lower' ? text.toLowerCase()
      : mode === 'upper' ? text.toUpperCase()
        : mode === 'capitalize' ? text.replace(/\b([a-z])/g, (m) => m.toUpperCase())
          : mode === 'sentence' ? text.toLowerCase().replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (m) => m.toUpperCase())
            : [...text].map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('')
  if (out === text) return false
  editor.chain().focus().insertContentAt({ from, to }, out).setTextSelection({ from, to: from + out.length }).run()
  const names: Record<CaseMode, string> = {
    sentence: '문장의 첫 글자만 대문자로', lower: '모두 소문자로', upper: '모두 대문자로',
    capitalize: '각 낱말 첫 글자를 대문자로', toggle: '대소문자를 뒤집었다',
  }
  flash(names[mode])
  return true
}

/** 밑줄 모양·색 — 워드의 밑줄 ▾ */
export const UNDERLINE_STYLES: { key: string; label: string }[] = [
  { key: 'solid', label: '한 줄' },
  { key: 'double', label: '두 줄' },
  { key: 'dotted', label: '점선' },
  { key: 'dashed', label: '파선' },
  { key: 'wavy', label: '물결선' },
]

export function setUnderlineStyle(editor: Editor, style: string | null, color?: string | null): boolean {
  if (!style) {
    editor.chain().focus().setMark('textStyle', { underlineStyle: null, underlineColor: null }).unsetUnderline().run()
    flash('밑줄을 없앴다')
    return true
  }
  editor.chain().focus().setUnderline().setMark('textStyle', { underlineStyle: style, underlineColor: color ?? null }).run()
  flash(`밑줄 — ${UNDERLINE_STYLES.find((u) => u.key === style)?.label || style}`)
  return true
}

/** 문자 테두리·문자 음영 — 워드의 「가」 테두리·음영 단추 */
export function setCharBorder(editor: Editor, color: string | null): boolean {
  editor.chain().focus().setMark('textStyle', { charBorder: color }).run()
  flash(color ? '문자 테두리를 둘렀다' : '문자 테두리를 없앴다')
  return true
}

export function setCharShading(editor: Editor, color: string | null): boolean {
  editor.chain().focus().setMark('textStyle', { charShading: color }).run()
  flash(color ? '문자 음영을 넣었다' : '문자 음영을 없앴다')
  return true
}

/* ── 단락 ───────────────────────────────────────────── */

export const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3]

export function setLineSpacing(editor: Editor, value: number): boolean {
  const ok = editor.chain().focus().updateAttributes('paragraph', { lineHeight: String(value) }).run()
    || editor.chain().focus().updateAttributes('heading', { lineHeight: String(value) }).run()
  if (ok) flash(`줄 간격 ${value}`)
  return ok
}

/** 단락 앞·뒤 공백 — 워드의 「단락 앞에 공백 추가/제거」 */
export function setParagraphSpace(editor: Editor, where: 'before' | 'after', px: number | null): boolean {
  const key = where === 'before' ? 'spaceBefore' : 'spaceAfter'
  const ok = editor.chain().focus().updateAttributes('paragraph', { [key]: px }).run()
  if (ok) flash(px ? `단락 ${where === 'before' ? '앞' : '뒤'} 공백 ${px}px` : '단락 공백을 없앴다')
  return ok
}

/** 단락 음영·테두리 — 워드 「단락」 묶음의 음영·테두리 */
export function setParagraphShading(editor: Editor, color: string | null): boolean {
  const ok = editor.chain().focus().updateAttributes('paragraph', { shading: color }).run()
  if (ok) flash(color ? '단락에 음영을 넣었다' : '단락 음영을 없앴다')
  return ok
}

export const PARA_BORDERS: { key: string; label: string }[] = [
  { key: 'all', label: '모든 테두리' },
  { key: 'top', label: '위쪽 테두리' },
  { key: 'bottom', label: '아래쪽 테두리' },
  { key: 'left', label: '왼쪽 테두리' },
  { key: 'right', label: '오른쪽 테두리' },
  { key: 'none', label: '테두리 없음' },
]

export function setParagraphBorder(editor: Editor, where: string): boolean {
  const ok = editor.chain().focus().updateAttributes('paragraph', { border: where === 'none' ? null : where }).run()
  if (ok) flash(where === 'none' ? '단락 테두리를 없앴다' : `단락 ${PARA_BORDERS.find((b) => b.key === where)?.label}`)
  return ok
}

/** 글머리 기호 라이브러리 — 워드의 글머리 ▾ */
export const BULLET_MARKS: { key: string; label: string; sample: string }[] = [
  { key: 'disc', label: '● 둥근 점', sample: '●' },
  { key: 'circle', label: '○ 빈 동그라미', sample: '○' },
  { key: 'square', label: '■ 네모', sample: '■' },
  { key: 'dash', label: '– 줄표', sample: '–' },
  { key: 'check', label: '✓ 체크', sample: '✓' },
  { key: 'arrow', label: '➤ 화살표', sample: '➤' },
]

export function setBulletStyle(editor: Editor, key: string): boolean {
  if (!editor.isActive('bulletList')) editor.chain().focus().toggleBulletList().run()
  const ok = editor.chain().focus().updateAttributes('bulletList', { bulletStyle: key }).run()
  if (ok) flash(`글머리 기호 ${BULLET_MARKS.find((b) => b.key === key)?.sample || ''}`)
  return ok
}

/** 번호 매기기 라이브러리 — 워드의 번호 ▾ */
export const NUMBER_MARKS: { key: string; label: string }[] = [
  { key: 'decimal', label: '1. 2. 3.' },
  { key: 'decimal-paren', label: '1) 2) 3)' },
  { key: 'lower-alpha', label: 'a. b. c.' },
  { key: 'upper-alpha', label: 'A. B. C.' },
  { key: 'lower-roman', label: 'i. ii. iii.' },
  { key: 'upper-roman', label: 'I. II. III.' },
  { key: 'korean', label: '가. 나. 다.' },
  { key: 'circled', label: '① ② ③' },
]

export function setNumberStyle(editor: Editor, key: string): boolean {
  if (!editor.isActive('orderedList')) editor.chain().focus().toggleOrderedList().run()
  const ok = editor.chain().focus().updateAttributes('orderedList', { numberStyle: key }).run()
  if (ok) flash(`번호 모양 ${NUMBER_MARKS.find((n) => n.key === key)?.label || ''}`)
  return ok
}

/* ── 편집 ───────────────────────────────────────────── */

/** 비슷한 서식의 글 모두 고르기 — 워드 「선택 › 비슷한 서식의 텍스트 선택」 */
export function selectSimilarFormatting(editor: Editor): boolean {
  const { from } = editor.state.selection
  const here = editor.state.doc.resolve(from).marks()
  const names = here.map((m) => m.type.name).sort().join(',')
  const spots: { from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return
    const mine = node.marks.map((m) => m.type.name).sort().join(',')
    if (mine === names) spots.push({ from: pos, to: pos + node.nodeSize })
  })
  if (!spots.length) { flash('같은 서식의 글을 찾지 못했다'); return false }
  // 여러 곳을 한 번에 고를 수는 없어, 가장 넓은 범위를 고르고 몇 곳인지 알려 준다
  const first = spots[0]
  const last = spots[spots.length - 1]
  editor.chain().focus().setTextSelection({ from: first.from, to: last.to }).run()
  flash(`같은 서식 ${spots.length}곳 — 처음부터 끝까지 골랐다`)
  return true
}

/** 문서 전체 고르기 (워드 「선택 › 모두 선택」) */
export function selectAll(editor: Editor): boolean {
  editor.chain().focus().selectAll().run()
  flash('문서 전체를 골랐다')
  return true
}
