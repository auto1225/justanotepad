import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode, Slice } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import type { StepMap } from '@tiptap/pm/transform'

/**
 * 변경 내용 추적 — 워드 「검토 › 변경 내용 추적」.
 *
 * 켜 두면 새로 쓴 글은 밑줄로, 지운 글은 지워진 줄로 남는다. 실제로 지우지 않고
 * 「지웠다」 는 표시만 붙여 두기 때문에 나중에 하나씩 「적용」·「되돌리기」 할 수 있다.
 *
 * 어떻게 잡아내나
 *  · 새로 넣은 글 — 문서가 바뀔 때마다 어디가 늘었는지 보고 넣음 표시를 붙인다.
 *    (명령·붙여넣기·한글 조합까지 모두 이 길을 지나므로 빠지는 곳이 없다)
 *  · 지운 글 — 지워진 조각을 그 자리에 되살려 놓고 지움 표시를 붙인다.
 *    Backspace·Delete 한 글자는 아예 지우지 않고 표시만 붙여 커서를 옮긴다.
 *
 * 문단을 합치거나 표를 통째로 지우는 것처럼 뼈대가 바뀌는 일은 그대로 지운다 —
 * 되살려 놓으면 문서 구조가 흔들려 오히려 손해다 (워드도 이 경우 표시가 거칠다).
 */

const AUTHOR_KEY = 'jan-v2-author'
const ON_KEY = 'jan-v2-track-on'

/** 이 문서를 손보는 사람 이름 — 표시에 함께 남는다 */
export function trackAuthor(): string {
  try { return localStorage.getItem(AUTHOR_KEY) || '나' } catch { return '나' }
}

export function setTrackAuthor(name: string) {
  try { localStorage.setItem(AUTHOR_KEY, name || '나') } catch { /* 저장 못 해도 이번 판은 쓴다 */ }
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

/* ── 표시 두 가지 ─────────────────────────────────────── */

const attrs = () => ({
  author: {
    default: '',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-by') || '',
    renderHTML: (a: Record<string, unknown>) => ({ 'data-by': String(a.author || '') }),
  },
  at: {
    default: '',
    parseHTML: (el: HTMLElement) => el.getAttribute('data-at') || '',
    renderHTML: (a: Record<string, unknown>) => ({ 'data-at': String(a.at || '') }),
  },
})

export const InsertMark = Mark.create({
  name: 'janIns',
  /** 이어 쓰는 글자도 같은 넣음 표시에 붙는다 */
  inclusive: true,
  excludes: 'janDel',
  addAttributes: attrs,
  parseHTML() {
    return [{ tag: 'ins[data-jan-ins]' }]
  },
  renderHTML({ HTMLAttributes, mark }) {
    const by = String(mark.attrs.author || '')
    return ['ins', mergeAttributes(HTMLAttributes, {
      'data-jan-ins': '1',
      class: 'jan-ins',
      title: by ? by + ' 넣음' : '넣음',
    }), 0]
  },
})

export const DeleteMark = Mark.create({
  name: 'janDel',
  inclusive: false,
  excludes: 'janIns',
  addAttributes: attrs,
  parseHTML() {
    return [{ tag: 'del[data-jan-del]' }]
  },
  renderHTML({ HTMLAttributes, mark }) {
    const by = String(mark.attrs.author || '')
    return ['del', mergeAttributes(HTMLAttributes, {
      'data-jan-del': '1',
      class: 'jan-del',
      title: by ? by + ' 지움' : '지움',
    }), 0]
  },
})

/* ── 추적 플러그인 ────────────────────────────────────── */

export const trackKey = new PluginKey('janTrack')

/** 인라인 조각만 되살린다 — 문단 경계가 섞인 조각은 뼈대까지 흔든다 */
function inlineOnly(slice: Slice): boolean {
  if (slice.openStart !== 0 || slice.openEnd !== 0) return false
  if (slice.content.size === 0) return false
  let ok = true
  slice.content.forEach((child) => { if (!child.isInline) ok = false })
  return ok
}

/**
 * 되살릴 조각을 지움 표시가 붙은 조각으로 바꾼다.
 * 내가 방금 넣은 글(넣음 표시가 내 이름)이라면 표시만 걷어 내고 진짜로 지운다 — 워드와 같다.
 */
function struck(content: Fragment, doc: PMNode, author: string): Fragment {
  const delType = doc.type.schema.marks.janDel
  const insType = doc.type.schema.marks.janIns
  const kept: PMNode[] = []
  content.forEach((child) => {
    const mine = insType && child.marks.some((m) => m.type === insType && m.attrs.author === author)
    if (mine) return
    if (!delType) { kept.push(child); return }
    kept.push(child.mark(delType.create({ author, at: stamp() }).addToSet(child.marks)))
  })
  return Fragment.fromArray(kept)
}

interface TrackStore { on: boolean }

export const TrackChanges = Extension.create({
  name: 'janTrack',

  addStorage() {
    let on = false
    try { on = localStorage.getItem(ON_KEY) === '1' } catch { /* 못 읽으면 꺼진 채로 */ }
    return { on } as TrackStore
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const store = this.storage as TrackStore

    return [
      new Plugin({
        key: trackKey,

        props: {
          /** 한 글자 지우기 — 진짜로 지우지 않고 표시만 붙이고 지나간다 */
          handleKeyDown(view, event) {
            if (!store.on) return false
            if (event.key !== 'Backspace' && event.key !== 'Delete') return false
            if (event.ctrlKey || event.metaKey || event.altKey) return false
            const { state } = view
            if (!state.selection.empty) return false

            const dir = event.key === 'Backspace' ? -1 : 1
            const $pos = state.doc.resolve(state.selection.from)
            const adj = dir < 0 ? $pos.nodeBefore : $pos.nodeAfter
            if (!adj || adj.isBlock) return false          // 문단 경계는 기본 동작 (합쳐진다)

            const width = adj.isText ? 1 : adj.nodeSize
            const from = dir < 0 ? state.selection.from - width : state.selection.from
            const to = from + width
            const delType = state.schema.marks.janDel
            const insType = state.schema.marks.janIns
            if (!delType) return false

            const author = trackAuthor()
            const marks = adj.marks
            /* 이미 지운 자리라면 표시를 겹치지 않고 커서만 건너뛴다 */
            if (marks.some((m) => m.type === delType)) {
              const tr = state.tr.setSelection(TextSelection.create(state.doc, dir < 0 ? from : to))
              view.dispatch(tr.scrollIntoView())
              return true
            }
            /* 내가 방금 넣은 글자는 흔적을 남길 것이 없다 — 그냥 지운다 */
            if (insType && marks.some((m) => m.type === insType && m.attrs.author === author)) return false

            const tr = state.tr
            tr.addMark(from, to, delType.create({ author, at: stamp() }))
            tr.setSelection(TextSelection.create(tr.doc, dir < 0 ? from : to))
            tr.setStoredMarks([])
            tr.setMeta('janTrack', 'del')
            view.dispatch(tr.scrollIntoView())
            return true
          },
        },

        appendTransaction(trs, oldState, newState) {
          if (!store.on) return null
          if (!trs.some((t) => t.docChanged)) return null
          /* 우리가 만든 것·되돌리기·문서 갈아 끼우기는 손대지 않는다 */
          if (trs.some((t) => t.getMeta('janTrack') || t.getMeta('janTrackSkip') || t.getMeta('history$'))) return null
          if (editor.isDestroyed) return null

          const insType = newState.schema.marks.janIns
          const delType = newState.schema.marks.janDel
          if (!insType || !delType) return null

          /* 단계별 문서와 자리 옮김표를 모아 둔다 (마지막 문서 좌표로 옮기기 위해) */
          const steps: { map: StepMap; before: PMNode; structural: boolean }[] = []
          for (const tr of trs) {
            tr.steps.forEach((step, i) => {
              steps.push({
                map: step.getMap(),
                before: tr.docs[i] ?? oldState.doc,
                structural: !(step instanceof ReplaceStep || step instanceof ReplaceAroundStep),
              })
            })
          }
          if (!steps.length) return null

          /* 문서를 통째로 갈아 끼운 것은 변경으로 보지 않는다 —
             메모 바꿈·파일 열기는 위에서 janTrackSkip 표를 달아 오지만, 표 없이 오는 길
             (템플릿 갈아 끼우기·가져오기)도 있어 한 겹 더 둔다. 빈 문서에 크게 붙여넣는 것은
             사람이 한 일이니 여기에 걸리지 않게 「제법 큰 문서」 일 때만 본다. */
          const before = oldState.doc.content.size
          const grew = Math.abs(newState.doc.content.size - before)
          if (steps.length === 1 && before > 40 && grew >= before * 0.9) return null

          const toFinal = (i: number, pos: number, assoc: 1 | -1) => {
            let p = pos
            for (let j = i + 1; j < steps.length; j++) p = steps[j].map.map(p, assoc)
            return p
          }

          const inserted: { from: number; to: number }[] = []
          const restores: { at: number; content: Fragment }[] = []

          steps.forEach((s, i) => {
            if (s.structural) return
            s.map.forEach((oldStart, oldEnd, newStart, newEnd) => {
              if (oldEnd > oldStart) {
                const cut = s.before.slice(oldStart, oldEnd)
                if (inlineOnly(cut)) {
                  const content = struck(cut.content, newState.doc, trackAuthor())
                  if (content.size) restores.push({ at: toFinal(i, newStart, -1), content })
                }
              }
              if (newEnd > newStart) {
                inserted.push({ from: toFinal(i, newStart, -1), to: toFinal(i, newEnd, 1) })
              }
            })
          })

          if (!inserted.length && !restores.length) return null

          const tr = newState.tr
          tr.setMeta('janTrack', 'auto')

          /* 되살리기는 뒤에서부터 — 앞자리 좌표가 흔들리지 않는다 */
          restores.sort((a, b) => b.at - a.at).forEach((r) => {
            if (r.at >= 0 && r.at <= tr.doc.content.size) tr.insert(r.at, r.content)
          })

          const mark = insType.create({ author: trackAuthor(), at: stamp() })
          inserted.forEach((range) => {
            const from = tr.mapping.map(range.from, 1)
            const to = tr.mapping.map(range.to, 1)
            if (to <= from) return
            /* 되살려 놓은 지움 표시 위에는 넣음 표시를 얹지 않는다 (서로 밀어낸다) */
            tr.doc.nodesBetween(from, to, (node, pos) => {
              if (!node.isInline) return
              if (node.marks.some((m) => m.type === delType)) return
              const a = Math.max(from, pos)
              const b = Math.min(to, pos + node.nodeSize)
              if (b > a) tr.addMark(a, b, mark)
            })
          })

          return tr.steps.length ? tr : null
        },
      }),
    ]
  },
})
