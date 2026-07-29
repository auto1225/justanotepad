import type { Editor } from '@tiptap/react'

/**
 * 단어 개수 — 워드 「검토 › 단어 개수」 대화상자.
 *
 * 워드가 세어 주는 것(쪽·단어·문자·문단·줄)에 우리말 문서에서 더 자주 묻는 것을
 * 보탰다: 공백 없는 글자 수(자기소개서·지원서가 요구하는 그 숫자)와 원고지 매수.
 */

export interface CountReport {
  pages: number
  words: number
  charsWithSpaces: number
  charsNoSpaces: number
  paragraphs: number
  lines: number
  /** 200자 원고지로 몇 장 (한글 문서에서 흔히 묻는다) */
  manuscript: number
  tables: number
  images: number
  footnotes: number
  /** 고른 글만 센 것인지 */
  selectionOnly: boolean
}

function textOf(editor: Editor, from?: number, to?: number): string {
  const doc = editor.state.doc
  const a = from ?? 0
  const b = to ?? doc.content.size
  /* 문단이 바뀌는 자리는 줄바꿈으로 이어 붙인다 — 붙여 세면 두 낱말이 한 낱말이 된다 */
  return doc.textBetween(a, b, '\n', ' ')
}

/** 화면에 그려진 줄 수 — 접힌 줄까지 세려면 실제로 놓인 자리를 봐야 한다 */
function countLines(editor: Editor): number {
  const root = editor.view.dom
  const blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th')
  let lines = 0
  blocks.forEach((el) => {
    const rects = (el as HTMLElement).getClientRects()
    lines += Math.max(1, rects.length)
  })
  return lines
}

export function countReport(editor: Editor | null): CountReport {
  const empty: CountReport = {
    pages: 0, words: 0, charsWithSpaces: 0, charsNoSpaces: 0, paragraphs: 0,
    lines: 0, manuscript: 0, tables: 0, images: 0, footnotes: 0, selectionOnly: false,
  }
  if (!editor) return empty

  const sel = editor.state.selection
  const selectionOnly = !sel.empty
  const text = selectionOnly ? textOf(editor, sel.from, sel.to) : textOf(editor)
  const charsWithSpaces = [...text.replace(/\n/g, '')].length
  const charsNoSpaces = [...text.replace(/\s/g, '')].length
  const words = text.split(/\s+/).filter(Boolean).length

  let paragraphs = 0
  let tables = 0
  let images = 0
  const scan = (from: number, to: number) => {
    editor.state.doc.nodesBetween(from, to, (node) => {
      const name = node.type.name
      if ((name === 'paragraph' || name === 'heading' || name === 'listItem') && node.textContent.trim()) paragraphs++
      if (name === 'table') tables++
      if (name === 'image' || name === 'janChart' || name === 'janSmart' || name === 'janModel3d') images++
    })
  }
  scan(selectionOnly ? sel.from : 0, selectionOnly ? sel.to : editor.state.doc.content.size)

  const pages = editor.view.dom.querySelectorAll('[data-jan-page]').length || 1
  const footnotes = editor.view.dom.querySelectorAll('.paper-fn-ref, .jan-en-ref').length

  return {
    pages,
    words,
    charsWithSpaces,
    charsNoSpaces,
    paragraphs,
    lines: countLines(editor),
    manuscript: Math.ceil(charsWithSpaces / 200),
    tables,
    images,
    footnotes,
    selectionOnly,
  }
}

/** 상태 줄·토스트에 한 줄로 알릴 때 */
export function countLine(r: CountReport): string {
  return `${r.selectionOnly ? '고른 글 — ' : ''}단어 ${r.words} · 글자 ${r.charsWithSpaces} (공백 없이 ${r.charsNoSpaces}) · ${r.pages}쪽`
}
