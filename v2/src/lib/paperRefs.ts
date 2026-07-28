import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { paperTagLabel, type PaperRefType } from '../extensions/PaperTag'
import { flash } from './flash'

/**
 * 수식 번호·그림/표 캡션·상호참조 (Overleaf \label/\ref 상당).
 * 번호는 PaperTag 노드 attrs(n)에 저장되고, renumberPaperTags 가
 * 문서 순서대로 재계산해 참조(ref)까지 key 기반으로 동기화한다.
 */

let keySeq = 0
function newKey(prefix: string): string {
  keySeq = (keySeq + 1) % 1679616
  return `${prefix}_${Date.now().toString(36)}${keySeq.toString(36)}`
}

function escAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface TagInfo {
  pos: number
  node: PMNode
}

function collectTags(editor: Editor): TagInfo[] {
  const out: TagInfo[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paperTag') out.push({ pos, node })
    return true
  })
  return out
}

function countKind(editor: Editor, kind: string): number {
  return collectTags(editor).filter((t) => t.node.attrs.kind === kind).length
}

/** 번호 수식 블록 삽입 — 수식 본문 + 오른쪽 정렬 번호 (n) */
export function insertNumberedEquation(editor: Editor, latex: string): void {
  const n = countKind(editor, 'eqnum') + 1
  const key = newKey('eq')
  const html =
    `<p data-paper-block="eq" data-paper-key="${key}">` +
    `<span data-math="block" latex="${escAttr(latex)}"></span>` +
    `<span data-paper-tag="eqnum" data-key="${key}" data-n="${n}"></span>` +
    `</p><p></p>`
  editor.chain().focus().insertContent(html).run()
}

/** 그림 캡션 삽입 — "Fig. n. 설명" (가운데 정렬은 CSS) */
export function insertFigureCaption(editor: Editor, text: string): void {
  const n = countKind(editor, 'figlabel') + 1
  const key = newKey('fig')
  const html =
    `<p data-paper-block="figcap" data-paper-key="${key}">` +
    `<span data-paper-tag="figlabel" data-key="${key}" data-n="${n}"></span> ${escHtml(text)}</p>`
  editor.chain().focus().insertContent(html).run()
}

/** 표 캡션 삽입 — "Table n. 설명" */
export function insertTableCaption(editor: Editor, text: string): void {
  const n = countKind(editor, 'tablabel') + 1
  const key = newKey('tab')
  const html =
    `<p data-paper-block="tabcap" data-paper-key="${key}">` +
    `<span data-paper-tag="tablabel" data-key="${key}" data-n="${n}"></span> ${escHtml(text)}</p>`
  editor.chain().focus().insertContent(html).run()
}

const KIND_BY_TYPE: Record<PaperRefType, string> = { eq: 'eqnum', fig: 'figlabel', tab: 'tablabel' }

/** n번째 대상의 key 를 찾아 상호참조 삽입. 대상이 없으면 false */
export function insertCrossRef(editor: Editor, refType: PaperRefType, n: number): boolean {
  const targets = collectTags(editor).filter((t) => t.node.attrs.kind === KIND_BY_TYPE[refType])
  if (targets.length === 0) return false
  const idx = Math.max(1, Math.min(n, targets.length))
  const target = targets[idx - 1]
  const html = `<span data-paper-tag="ref" data-ref-type="${refType}" data-key="${escAttr(target.node.attrs.refKey || '')}" data-n="${idx}"></span>`
  editor.chain().focus().insertContent(html + ' ').run()
  return true
}

export function paperTargetCount(editor: Editor, refType: PaperRefType): number {
  return collectTags(editor).filter((t) => t.node.attrs.kind === KIND_BY_TYPE[refType]).length
}

/**
 * 수식·그림·표 번호를 문서 순서대로 재계산하고 참조를 key 로 동기화.
 * PM 트랜잭션으로 attrs 만 갱신 — 커서·스크롤 유지.
 * 반환: 갱신된 태그 수
 */
export function renumberPaperTags(editor: Editor): number {
  const tags = collectTags(editor)
  if (tags.length === 0) return 0
  const counters: Record<string, number> = { eqnum: 0, figlabel: 0, tablabel: 0 }
  const keyToN = new Map<string, number>()

  // 1차: 번호 대상(eqnum/figlabel/tablabel)에 순서대로 n 부여
  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = []
  for (const t of tags) {
    const kind = t.node.attrs.kind as string
    if (kind in counters) {
      counters[kind] += 1
      const n = counters[kind]
      if (t.node.attrs.refKey) keyToN.set(t.node.attrs.refKey, n)
      if (t.node.attrs.n !== n) updates.push({ pos: t.pos, attrs: { ...t.node.attrs, n } })
    }
  }
  // 2차: 참조(ref)를 대상 key 의 새 번호로
  for (const t of tags) {
    if (t.node.attrs.kind !== 'ref') continue
    const mapped = keyToN.get(t.node.attrs.refKey)
    if (mapped && t.node.attrs.n !== mapped) updates.push({ pos: t.pos, attrs: { ...t.node.attrs, n: mapped } })
  }
  if (updates.length > 0) {
    // attrs 만 바꾸므로 노드 크기가 변하지 않아 한 트랜잭션 안에서 위치가 유효하다
    const tr = editor.state.tr
    for (const u of updates) tr.setNodeMarkup(u.pos, undefined, u.attrs)
    editor.view.dispatch(tr)
  }
  return updates.length
}

export { paperTagLabel }

/** 렌더 후 사용자 피드백용 요약 */
export function renumberWithFeedback(editor: Editor): void {
  const changed = renumberPaperTags(editor)
  const eq = countKind(editor, 'eqnum')
  const fig = countKind(editor, 'figlabel')
  const tab = countKind(editor, 'tablabel')
  flash(`재정렬 완료 — 수식 ${eq} · 그림 ${fig} · 표 ${tab} (변경 ${changed}건)`)
}
