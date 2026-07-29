import type { Editor } from '@tiptap/react'

/**
 * 커서가 놓인 낱말 집어내기.
 * 동의어 사전·한자 바꾸기는 「고른 글」 이 없어도 커서가 짚은 낱말을 다룰 수 있어야 한다
 * (한글·워드도 그렇게 움직인다 — 낱말 안에 커서만 두고 F9 를 누른다).
 */

export interface WordSpot {
  text: string
  from: number
  to: number
}

const BREAK = /[\s.,·:;!?"'()[\]{}〈〉《》「」『』…—/\\|+*=<>~`@#$%^&]/

export function wordAtCursor(editor: Editor | null): WordSpot | null {
  if (!editor) return null
  const { state } = editor
  const sel = state.selection
  if (!sel.empty) {
    const text = state.doc.textBetween(sel.from, sel.to, ' ', ' ').trim()
    return text ? { text, from: sel.from, to: sel.to } : null
  }

  const $pos = state.doc.resolve(sel.from)
  const parent = $pos.parent
  if (!parent.isTextblock) return null
  const start = $pos.start()
  const line = parent.textContent
  if (!line) return null

  const offset = sel.from - start
  let a = offset
  let b = offset
  while (a > 0 && !BREAK.test(line[a - 1])) a--
  while (b < line.length && !BREAK.test(line[b])) b++
  const text = line.slice(a, b).trim()
  if (!text) return null
  return { text, from: start + a, to: start + b }
}

/** 그 자리를 다른 글로 바꿔 넣는다 (바꾼 글을 고른 채로 둔다) */
export function replaceSpot(editor: Editor | null, spot: WordSpot, text: string): boolean {
  if (!editor || !text) return false
  editor.chain().focus()
    .insertContentAt({ from: spot.from, to: spot.to }, text)
    .setTextSelection({ from: spot.from, to: spot.from + text.length })
    .run()
  return true
}
