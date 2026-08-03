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
  /** 캡션(paperTag)이 지닌 이름표 — 캡션으로만 있는 대상은 이것으로 찾는다 */
  capKey?: string
  /** 문서 안에서 이 대상을 다시 찾는 열쇠 (제목 글·책갈피 이름·차례 번호) */
  id: string
  /** 사람이 보는 이름 — 목록에 뜬다 */
  label: string
  /** 「표 3」 처럼 붙는 번호 */
  number: string
  /** 제목 글 등 본문 */
  text: string
  /** 이 대상이 쓰는 이름 낱말 — 캡션이 정한 것이 있으면 그것을 따른다 (그림 · Fig.) */
  word?: string
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
 * 참조 대상 하나가 될 「거리」 — 개체 노드일 수도 있고 캡션 줄일 수도 있다.
 *
 * 참조 갈래가 두 벌로 따로 놀았다. 상호 참조 창은 image·table 「노드」 만 세고,
 * 캡션(paperTag)은 논문 쪽 번호 매기기가 따로 세었다. 그래서 캡션이 셋 있는 문서에서
 * 창은 「그림 (0) · 표 (0)」 이라고 했다. 워드에서 「참조 대상: 그림」 은 곧 캡션 목록이다.
 */
interface Piece {
  src: 'node' | 'cap'
  pos: number
  refId?: string
  capKey?: string
  word?: string
  text: string
}

interface Merged {
  pos: number
  refId?: string
  capKey?: string
  word?: string
  text: string
  hasNode: boolean
  hasCap: boolean
}

/**
 * 개체와 그 캡션을 한 대상으로 묶는다.
 *
 * 그림 아래(워드) · 표 위(워드·한글)에 캡션이 온다. 묶지 않으면 그림 하나에 캡션 하나를 단
 * 문서가 「그림 2개」 로 세어져 번호가 곱절이 된다. 바로 이웃한 것만 묶는다.
 */
function mergePieces(pieces: Piece[]): Merged[] {
  const out: Merged[] = []
  for (const p of pieces) {
    const last = out[out.length - 1]
    if (p.src === 'cap' && last && last.hasNode && !last.hasCap) {
      last.hasCap = true
      last.capKey = p.capKey
      last.word = p.word
      if (p.text) last.text = p.text
      continue
    }
    if (p.src === 'node' && last && last.hasCap && !last.hasNode) {
      last.hasNode = true
      last.refId = last.refId || p.refId
      if (!last.text) last.text = p.text
      continue
    }
    out.push({ pos: p.pos, refId: p.refId, capKey: p.capKey, word: p.word, text: p.text, hasNode: p.src === 'node', hasCap: p.src === 'cap' })
  }
  return out
}

/** 캡션 줄에서 라벨 노드를 빼고 설명만 (라벨은 노드가 그린 글이라 글자열로는 못 벗긴다) */
function capPiece(node: PMNode, pos: number, kinds: string[]): Piece {
  let capKey = ''
  let word: string | undefined
  let text = ''
  node.forEach((child) => {
    if (child.type.name === 'paperTag' && kinds.includes(String(child.attrs.kind))) {
      capKey = String(child.attrs.refKey || '')
      word = (child.attrs.label as string | null) || undefined
      return
    }
    text += child.textContent || ''
  })
  /* 손으로 적은 캡션(«Table 1. 설명»)은 라벨 노드가 없다 — 글자열에서 벗긴다 */
  const only = text.replace(/^\s*(그림|표|수식|Fig\.?|Table|Eq\.?)?\s*\d*\s*[.:]?\s*/i, '').trim()
  return { src: 'cap', pos, capKey: capKey || undefined, word, text: only }
}

/**
 * 문서를 훑어 참조할 수 있는 자리를 모은다.
 * doc 을 따로 주면 그것을 본다 — 문서가 바뀌는 순간(appendTransaction)에는
 * editor.state 가 아직 예전 것이라, 갓 바뀐 문서를 넘겨야 번호가 한 박자 늦지 않는다.
 */
export function collectTargets(editor: Editor | null, doc?: PMNode): RefTarget[] {
  if (!editor || editor.isDestroyed) return []
  const out: RefTarget[] = []
  const count: Record<string, number> = { chart: 0, footnote: 0 }
  const numbers: number[] = [0, 0, 0, 0, 0, 0]
  const figs: Piece[] = []
  const tabs: Piece[] = []
  const eqs: Piece[] = []

  ;(doc || editor.state.doc).descendants((node, pos) => {
    const name = node.type.name
    /* 캡션 줄 — 안으로 들어가지 않는다 (라벨·수식 노드를 두 번 세게 된다) */
    const block = node.attrs?.['data-paper-block'] as string | undefined
    if (block === 'figcap') { figs.push(capPiece(node, pos, ['figlabel'])); return false }
    if (block === 'tabcap') { tabs.push(capPiece(node, pos, ['tablabel'])); return false }
    if (block === 'eq') { eqs.push(capPiece(node, pos, ['eqnum'])); return false }
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
      tabs.push({ src: 'node', pos, refId: node.attrs.janRef || undefined, text: tableCaption(node) })
      return
    }
    if (name === 'image' || name === 'janImage') {
      figs.push({ src: 'node', pos, refId: node.attrs.janRef || undefined, text: String(node.attrs?.caption || node.attrs?.alt || '').trim() })
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
      eqs.push({ src: 'node', pos, text: '' })
      return
    }
    if (name === 'footnote' || node.attrs?.['data-footnote']) {
      count.footnote += 1
      out.push({ kind: 'footnote', id: `footnote:${count.footnote}`, label: `각주 ${count.footnote}`, number: String(count.footnote), text: node.textContent.trim(), pos })
    }
  })

  /* 개체와 캡션을 묶어 갈래마다 하나씩 — 워드의 「참조 대상」 목록과 같은 차례 */
  const 채우기 = (kind: RefKind, pieces: Piece[], fallbackWord: string) => {
    mergePieces(pieces).forEach((m, i) => {
      const n = String(i + 1)
      const word = m.word || fallbackWord
      out.push({
        kind,
        id: `${kind}:${n}`,
        refId: m.refId || m.capKey || undefined,
        capKey: m.capKey,
        label: `${word} ${n}${m.text ? ' — ' + m.text : ''}`,
        number: n,
        text: m.text,
        word,
        pos: m.pos,
      })
    })
  }
  채우기('figure', figs, KIND_WORD.figure)
  채우기('table', tabs, KIND_WORD.table)
  채우기('equation', eqs, KIND_WORD.equation)

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
  /* 캡션이 정한 이름을 그대로 쓴다 — 캡션은 「그림 2.」 인데 참조만 「Fig. 2」 이면 안 된다 */
  const word = target.word ?? KIND_WORD[target.kind]
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


/**
 * 이름표로 대상을 다시 찾는다.
 *
 * 이름표가 붙은 참조는 이름표로만 찾는다. 못 찾으면 대상이 사라진 것이고, 그때는
 * 아무것도 돌려주지 않아 「[참조 없음]」 이 뜬다 — 워드가 「오류! 참조 원본을 찾을 수
 * 없습니다」 를 띄우는 자리와 같다.
 *
 * 예전에는 못 찾으면 「몇 번째」 로 물러섰다. 그러면 참조가 조용히 남의 것을 가리킨다.
 * 재어 보니 그림 다섯에 참조 다섯을 달고 셋째 그림을 지웠을 때
 *   전: 그림 1 · 그림 2 · 그림 3 · 그림 4 · 그림 5
 *   후: 그림 1 · 그림 2 · 그림 3 · 그림 3 · 그림 4
 * 셋째 참조가 지워진 그림 대신 「그림 3」(예전의 넷째)을 가리켰다. 두 참조가 같은 번호를
 * 달고 서로 다른 것을 뜻하는데, 화면에는 아무 표도 나지 않는다 — 글이 조용히 틀린다.
 *
 * 이름표가 없는 참조(이름표를 붙이기 전에 만든 옛 문서)만 예전 길로 둔다.
 */
export function findTarget(targets: RefTarget[], refId?: string, fallbackId?: string): RefTarget | undefined {
  /* 이름표는 두 갈래다 — 개체에 붙인 janRef 와 캡션이 지닌 refKey.
     그림에 캡션을 나중에 달아도 예전 참조가 길을 잃지 않도록 둘 다 살핀다. */
  if (refId) return targets.find((t) => t.refId === refId || t.capKey === refId)
  return targets.find((t) => t.id === fallbackId)
}
