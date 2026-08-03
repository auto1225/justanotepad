import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { captionLang, captionWord, paperTagLabel, rememberCaptionLang, type CaptionLang, type PaperRefType, type PaperTagKind } from '../extensions/PaperTag'
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

/** 그림 캡션 삽입 — "그림 n. 설명" (가운데 정렬은 CSS) */
export function insertFigureCaption(editor: Editor, text: string, label?: string): void {
  const n = countKind(editor, 'figlabel') + 1
  const key = newKey('fig')
  const word = label || captionWord('figlabel', null)
  const html =
    `<p data-paper-block="figcap" data-paper-key="${key}">` +
    `<span data-paper-tag="figlabel" data-key="${key}" data-n="${n}" data-label="${escAttr(word)}"></span> ${escHtml(text)}</p>`
  editor.chain().focus().insertContent(html).run()
}

/** 표 캡션 삽입 — "표 n. 설명" */
export function insertTableCaption(editor: Editor, text: string, label?: string): void {
  const n = countKind(editor, 'tablabel') + 1
  const key = newKey('tab')
  const word = label || captionWord('tablabel', null)
  const html =
    `<p data-paper-block="tabcap" data-paper-key="${key}">` +
    `<span data-paper-tag="tablabel" data-key="${key}" data-n="${n}" data-label="${escAttr(word)}"></span> ${escHtml(text)}</p>`
  editor.chain().focus().insertContent(html).run()
}

const KIND_BY_TYPE: Record<PaperRefType, string> = { eq: 'eqnum', fig: 'figlabel', tab: 'tablabel' }

/** n번째 대상의 key 를 찾아 상호참조 삽입. 대상이 없으면 false */
export function insertCrossRef(editor: Editor, refType: PaperRefType, n: number): boolean {
  const targets = collectTags(editor).filter((t) => t.node.attrs.kind === KIND_BY_TYPE[refType])
  if (targets.length === 0) return false
  const idx = Math.max(1, Math.min(n, targets.length))
  const target = targets[idx - 1]
  /* 가리키는 캡션과 같은 낱말을 쓴다 — 캡션은 「그림 2.」 인데 참조만 「Fig. 2」 이면 안 된다 */
  const word = String(target.node.attrs.label || captionWord('ref', refType))
  const html = `<span data-paper-tag="ref" data-ref-type="${refType}" data-key="${escAttr(target.node.attrs.refKey || '')}" data-n="${idx}" data-label="${escAttr(word)}"></span>`
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
  const keyToLabel = new Map<string, string | null>()

  // 1차: 번호 대상(eqnum/figlabel/tablabel)에 순서대로 n 부여
  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = []
  for (const t of tags) {
    const kind = t.node.attrs.kind as string
    if (kind in counters) {
      counters[kind] += 1
      const n = counters[kind]
      if (t.node.attrs.refKey) {
        keyToN.set(t.node.attrs.refKey, n)
        keyToLabel.set(t.node.attrs.refKey, (t.node.attrs.label as string | null) ?? null)
      }
      if (t.node.attrs.n !== n) updates.push({ pos: t.pos, attrs: { ...t.node.attrs, n } })
    }
  }
  // 2차: 참조(ref)를 대상 key 의 새 번호와 라벨로 (캡션이 「그림」 이면 참조도 「그림」)
  for (const t of tags) {
    if (t.node.attrs.kind !== 'ref') continue
    const mapped = keyToN.get(t.node.attrs.refKey)
    if (!mapped) continue
    const label = keyToLabel.get(t.node.attrs.refKey) ?? null
    const 라벨다름 = keyToLabel.has(t.node.attrs.refKey) && (t.node.attrs.label ?? null) !== label
    if (t.node.attrs.n !== mapped || 라벨다름) updates.push({ pos: t.pos, attrs: { ...t.node.attrs, n: mapped, label } })
  }
  if (updates.length > 0) {
    // attrs 만 바꾸므로 노드 크기가 변하지 않아 한 트랜잭션 안에서 위치가 유효하다
    const tr = editor.state.tr
    for (const u of updates) tr.setNodeMarkup(u.pos, undefined, u.attrs)
    editor.view.dispatch(tr)
  }
  return updates.length
}

export { paperTagLabel, captionLang, captionWord }

/**
 * 캡션 라벨을 문서 전체에 걸쳐 한 말로 맞춘다 — 워드 「캡션 › 레이블」 을 문서 설정으로 옮긴 것.
 *
 * 새 캡션에만 걸면 한 문서에 「그림 1.」 과 「Fig. 2.」 가 섞인다. 그래서 이미 있는 캡션과
 * 그것을 가리키는 참조까지 함께 갈아 끼운다 (attrs 만 바꾸므로 쪽 나눔은 흔들리지 않는다).
 * 반환: 바뀐 태그 수
 */
export function setCaptionLabelLang(editor: Editor, lang: CaptionLang): number {
  rememberCaptionLang(lang)
  const tags = collectTags(editor)
  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = []
  for (const t of tags) {
    const kind = t.node.attrs.kind as PaperTagKind
    if (kind === 'eqnum') continue
    const refType = (t.node.attrs.refType ?? null) as PaperRefType | null
    const word = captionWord(kind, refType, lang)
    if (!word || t.node.attrs.label === word) continue
    updates.push({ pos: t.pos, attrs: { ...t.node.attrs, label: word } })
  }
  if (updates.length > 0) {
    const tr = editor.state.tr
    for (const u of updates) tr.setNodeMarkup(u.pos, undefined, u.attrs)
    editor.view.dispatch(tr)
  }
  flash(`캡션 라벨 — ${lang === 'ko' ? '한국어 (그림 · 표)' : '영어 (Fig. · Table)'}${updates.length ? ` · ${updates.length}곳을 고쳤습니다` : ''}`)
  return updates.length
}

/**
 * 번호를 손으로 다시 매기지 않아도 되게 — 문서가 바뀌면 스스로 따라간다.
 *
 * 그림 하나를 가운데 끼워 넣으면 그 뒤의 번호가 모두 한 칸씩 밀린다. 그런데 지금까지는
 * 「번호 모두 다시 매기기」 를 누를 때만 맞춰졌다. 누르는 것을 잊으면 「그림 3에서 보듯」 이
 * 엉뚱한 그림을 가리킨다 — 글이 조용히 틀린다. 그 자리를 사람 손에 맡길 일이 아니다.
 *
 * 번호가 실제로 어긋났을 때만 트랜잭션을 낸다 (attrs 만 바꾸므로 커서와 스크롤은 그대로다).
 * 되돌리기가 번호 맞추기 한 걸음에 걸리지 않도록 잠깐 쉬었다 처리한다.
 */
export function watchPaperNumbers(editor: Editor, waitMs = 400): () => void {
  let timer: number | undefined
  let inFlight = false

  const run = () => {
    if (editor.isDestroyed || inFlight) return
    inFlight = true
    try { renumberPaperTags(editor) } finally { inFlight = false }
  }

  const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
    /* 우리가 낸 번호 트랜잭션에 다시 반응하지 않는다 */
    if (!transaction.docChanged || inFlight) return
    window.clearTimeout(timer)
    timer = window.setTimeout(run, waitMs)
  }

  editor.on('transaction', onTransaction)
  return () => {
    window.clearTimeout(timer)
    editor.off('transaction', onTransaction)
  }
}

/** 렌더 후 사용자 피드백용 요약 */
export function renumberWithFeedback(editor: Editor): void {
  const changed = renumberPaperTags(editor)
  const eq = countKind(editor, 'eqnum')
  const fig = countKind(editor, 'figlabel')
  const tab = countKind(editor, 'tablabel')
  flash(`재정렬 완료 — 수식 ${eq} · 그림 ${fig} · 표 ${tab} (변경 ${changed}건)`)
}
