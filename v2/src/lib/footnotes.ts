import type { Editor } from '@tiptap/react'
import type { Mark as PMMark } from '@tiptap/pm/model'

/**
 * 각주 번호 관리.
 *
 * 각주 하나는 표식이 둘이다 — 문장 속 참조 <sup>[1]</sup> 과
 * 문서 끝 각주 줄의 머리 번호 <sup>[1]</sup> 각주 내용.
 * 이 둘을 구분하지 않으면 두 번째 각주가 [3] 이 되고,
 * 번호를 다시 매길 때도 참조와 본문이 1,2,3,4 로 이어져 짝이 어긋난다.
 * 그래서 본문 줄의 머리 번호에는 표시(paper-fn-body)를 달고 따로 센다.
 */
const REF_CLASS = 'paper-fn-ref'
const BODY_CLASS = 'paper-fn-body'

export interface FootnoteMark {
  from: number
  to: number
  marks: readonly PMMark[]
  /** 각주 본문 줄의 머리 번호인가 (아니면 문장 속 참조) */
  isBody: boolean
}

function isFootnoteMark(mark: PMMark): boolean {
  if (mark.type.name !== 'superscript') return false
  const cls = mark.attrs.class
  return typeof cls === 'string' && cls.split(/\s+/).includes(REF_CLASS)
}

export function collectFootnoteMarks(editor: Editor): FootnoteMark[] {
  const out: FootnoteMark[] = []
  const { doc } = editor.state
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    const mark = node.marks.find(isFootnoteMark)
    if (!mark) return true
    const cls = String(mark.attrs.class || '')
    // 표시가 붙어 있으면 그대로 믿고, 표시가 없는 옛 문서는 "문단 맨 앞이면 본문" 으로 본다
    const isBody = cls.split(/\s+/).includes(BODY_CLASS) || doc.resolve(pos).parentOffset === 0
    out.push({ from: pos, to: pos + node.nodeSize, marks: node.marks, isBody })
    return true
  })
  return out
}

/** 문장 속 각주 참조 개수 — 다음 각주 번호의 근거 */
export function countFootnoteRefs(editor: Editor): number {
  return collectFootnoteMarks(editor).filter((m) => !m.isBody).length
}

/** 커서 자리에 각주 참조를, 문서 끝에 같은 번호의 각주 줄을 넣는다 */
export function insertFootnote(editor: Editor): number {
  const n = countFootnoteRefs(editor) + 1
  editor.chain().focus().insertContent(`<sup class="${REF_CLASS}">[${n}]</sup>`).run()
  // DOM 을 읽어 setContent 하면 페이지네이션 위젯이 본문으로 재주입된다 — 트랜잭션으로만 추가
  const end = editor.state.doc.content.size
  editor.chain().insertContentAt(end, `<p><sup class="${REF_CLASS} ${BODY_CLASS}">[${n}]</sup> 각주 내용 — 클릭해서 편집</p>`).run()
  return n
}

/** 참조와 각주 줄을 각각 1부터 다시 매긴다. 반환: 손본 표식 수 */
export function renumberFootnotes(editor: Editor): number {
  const marks = collectFootnoteMarks(editor)
  if (!marks.length) return 0
  const { state } = editor
  let refN = 0
  let bodyN = 0
  const numbered = marks.map((m) => ({ ...m, label: `[${m.isBody ? ++bodyN : ++refN}]` }))
  let tr = state.tr
  let changed = 0
  // 뒤에서부터 바꿔야 앞쪽 위치가 밀리지 않는다
  for (let i = numbered.length - 1; i >= 0; i--) {
    const m = numbered[i]
    if (state.doc.textBetween(m.from, m.to) === m.label) continue
    tr = tr.replaceWith(m.from, m.to, state.schema.text(m.label, m.marks as PMMark[]))
    changed++
  }
  if (changed > 0) editor.view.dispatch(tr)
  return changed
}
