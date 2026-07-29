import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * 상호 참조 — 워드 「삽입 › 상호 참조」.
 *
 * "표 3 참조", "그림 2 참조", "3.1 절 참조" 처럼 문서 안의 다른 자리를 가리킨다.
 * 가리킨 자리가 밀리거나 번호가 바뀌면 참조도 저절로 따라 바뀐다 —
 * 워드는 F9 로 새로 고쳐야 하지만 우리는 문서가 바뀔 때마다 스스로 맞춘다.
 */

export type RefKind = 'heading' | 'table' | 'figure' | 'chart' | 'equation' | 'bookmark' | 'footnote'
export type RefShow = 'full' | 'number' | 'text' | 'page'

export interface RefTarget {
  kind: RefKind
  /** 대상에 붙은 이름표 — 앞에 무엇이 끼어들어도 이것으로 다시 찾는다 */
  refId?: string
  /** 문서 안에서 이 대상을 다시 찾는 열쇠 (제목 글·책갈피 이름·차례 번호) */
  id: string
  /** 사람이 보는 이름 — 목록에 뜬다 */
  label: string
  /** 「표 3」 처럼 붙는 번호 */
  number: string
  /** 제목 글 등 본문 */
  text: string
  pos: number
}

export const REF_KINDS: Array<{ key: RefKind; label: string }> = [
  { key: 'heading', label: '제목(개요)' },
  { key: 'table', label: '표' },
  { key: 'figure', label: '그림' },
  { key: 'chart', label: '차트' },
  { key: 'equation', label: '수식' },
  { key: 'bookmark', label: '책갈피' },
  { key: 'footnote', label: '각주' },
]

export const REF_SHOWS: Array<{ key: RefShow; label: string; hint: string }> = [
  { key: 'full', label: '번호와 글', hint: '표 3 — 감지 방식 비교' },
  { key: 'number', label: '번호만', hint: '표 3' },
  { key: 'text', label: '글만', hint: '감지 방식 비교' },
  { key: 'page', label: '쪽 번호', hint: '5쪽' },
]

const KIND_WORD: Record<RefKind, string> = {
  heading: '', table: '표', figure: '그림', chart: '차트', equation: '수식', bookmark: '', footnote: '각주',
}

/**
 * 문서를 훑어 참조할 수 있는 자리를 모은다.
 * doc 을 따로 주면 그것을 본다 — 문서가 바뀌는 순간(appendTransaction)에는
 * editor.state 가 아직 예전 것이라, 갓 바뀐 문서를 넘겨야 번호가 한 박자 늦지 않는다.
 */
export function collectTargets(editor: Editor | null, doc?: PMNode): RefTarget[] {
  if (!editor || editor.isDestroyed) return []
  const out: RefTarget[] = []
  const count: Record<string, number> = { table: 0, figure: 0, chart: 0, equation: 0, footnote: 0 }
  const numbers: number[] = [0, 0, 0, 0, 0, 0]

  ;(doc || editor.state.doc).descendants((node, pos) => {
    const name = node.type.name
    if (name === 'heading') {
      const level = Math.max(1, Math.min(6, Number(node.attrs.level) || 1))
      numbers[level - 1] += 1
      for (let i = level; i < 6; i++) numbers[i] = 0
      const num = numbers.slice(0, level).filter((n, i) => i === 0 || n > 0).join('.')
      const text = node.textContent.trim()
      if (text) out.push({ kind: 'heading', id: `h:${text}`, refId: node.attrs.janRef || undefined, label: `${num} ${text}`, number: num, text, pos })
      return
    }
    if (name === 'table') {
      count.table += 1
      const cap = tableCaption(node)
      out.push({ kind: 'table', id: `table:${count.table}`, refId: node.attrs.janRef || undefined, label: `표 ${count.table}${cap ? ' — ' + cap : ''}`, number: String(count.table), text: cap, pos })
      return
    }
    if (name === 'image' || name === 'janImage') {
      count.figure += 1
      const cap = String(node.attrs?.caption || node.attrs?.alt || '').trim()
      out.push({ kind: 'figure', id: `figure:${count.figure}`, refId: node.attrs.janRef || undefined, label: `그림 ${count.figure}${cap ? ' — ' + cap : ''}`, number: String(count.figure), text: cap, pos })
      return
    }
    if (name === 'janChart') {
      count.chart += 1
      const spec = node.attrs?.spec as { title?: string } | undefined
      const cap = String(spec?.title || '').trim()
      out.push({ kind: 'chart', id: `chart:${count.chart}`, refId: node.attrs.janRef || undefined, label: `차트 ${count.chart}${cap ? ' — ' + cap : ''}`, number: String(count.chart), text: cap, pos })
      return
    }
    if (name === 'mathBlock' || name === 'math' || name === 'janMath') {
      count.equation += 1
      out.push({ kind: 'equation', id: `equation:${count.equation}`, label: `수식 ${count.equation}`, number: String(count.equation), text: '', pos })
      return
    }
    if (name === 'footnote' || node.attrs?.['data-footnote']) {
      count.footnote += 1
      out.push({ kind: 'footnote', id: `footnote:${count.footnote}`, label: `각주 ${count.footnote}`, number: String(count.footnote), text: node.textContent.trim(), pos })
    }
  })

  // 책갈피는 글자 안에 들어 있어 DOM 에서 찾는다 (span[data-bookmark])
  try {
    const root = editor.view.dom
    root.querySelectorAll('[data-bookmark]').forEach((el) => {
      const name = (el as HTMLElement).getAttribute('data-bookmark') || ''
      if (!name) return
      let pos: number
      try { pos = editor.view.posAtDOM(el, 0) } catch { pos = 0 }
      out.push({ kind: 'bookmark', id: `bookmark:${name}`, label: `책갈피 ${name}`, number: '', text: name, pos })
    })
  } catch { /* 화면이 아직 없으면 책갈피는 건너뛴다 */ }

  return out
}

function tableCaption(node: { childCount: number; child: (i: number) => { textContent: string } }): string {
  // 표 바로 위/아래 설명은 문서 구조상 따로 있으므로, 첫 줄 첫 칸을 이름으로 쓴다
  try {
    const firstRow = node.child(0)
    return firstRow?.textContent?.trim().slice(0, 24) || ''
  } catch {
    return ''
  }
}

/** 참조가 보여 줄 글 */
export function refText(target: RefTarget | undefined, show: RefShow, page?: number): string {
  if (!target) return '[참조 없음]'
  const word = KIND_WORD[target.kind]
  switch (show) {
    case 'number': return word ? `${word} ${target.number}` : target.number || target.text
    case 'text': return target.text || target.label
    case 'page': return page ? `${page}쪽` : '?쪽'
    default:
      return word
        ? `${word} ${target.number}${target.text ? ' — ' + target.text : ''}`
        : target.number ? `${target.number} ${target.text}` : target.text
  }
}

/** 참조가 가리키는 자리로 옮겨 간다 */
export function gotoTarget(editor: Editor | null, id: string): boolean {
  const target = collectTargets(editor).find((t) => t.id === id)
  if (!editor || !target) return false
  editor.chain().focus().setTextSelection(Math.max(1, target.pos)).scrollIntoView().run()
  return true
}

/** 이 참조가 놓인 쪽 번호 (독립 페이지 모델에서만 뜻이 있다) */
export function pageOfPos(editor: Editor | null, pos: number): number | undefined {
  if (!editor || editor.isDestroyed) return undefined
  try {
    const dom = editor.view.domAtPos(pos)?.node as HTMLElement | null
    const el = dom?.nodeType === 1 ? dom : dom?.parentElement
    const page = el?.closest?.('[data-jan-page]')
    if (!page) return undefined
    const pages = [...editor.view.dom.querySelectorAll('[data-jan-page]')]
    const idx = pages.indexOf(page as Element)
    return idx >= 0 ? idx + 1 : undefined
  } catch {
    return undefined
  }
}


/** 이름표로 대상을 다시 찾는다 — 없으면 예전 방식(몇 번째)으로 물러선다 */
export function findTarget(targets: RefTarget[], refId?: string, fallbackId?: string): RefTarget | undefined {
  return (refId ? targets.find((t) => t.refId === refId) : undefined) || targets.find((t) => t.id === fallbackId)
}
