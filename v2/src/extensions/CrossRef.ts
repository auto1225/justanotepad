import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { collectTargets, findTarget, pageOfPos, refText } from '../lib/crossRef'
import { newRefId, REF_TARGET_TYPES } from './RefTargets'
import type { RefKind, RefShow } from '../lib/crossRef'

/**
 * 상호 참조 조각 — 글 사이에 끼어 「표 3」·「3.1 절」 처럼 다른 자리를 가리킨다.
 *
 * 가리킨 곳의 번호가 바뀌면 이 조각의 글도 스스로 바뀐다 (워드는 F9 를 눌러야 한다).
 * 그 일은 아래 플러그인이 문서가 바뀔 때마다 조용히 해 준다 — 되돌리기 기록에는 남기지 않는다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janXref: {
      insertCrossRef: (opts: { kind: RefKind; targetId: string; show: RefShow; link?: boolean }) => ReturnType
    }
  }
}

const refreshKey = new PluginKey('janXrefRefresh')

export const CrossRef = Node.create({
  name: 'janXref',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addAttributes() {
    const str = (name: string, def = '') => ({
      default: def,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) || def,
      renderHTML: () => ({}),
    })
    return {
      kind: str('kind', 'heading'),
      targetId: str('target', ''),
      /* 대상에 붙인 이름표 — 앞에 다른 표·그림이 끼어들어도 이것으로 다시 찾는다 */
      targetRef: str('target-ref', ''),
      show: str('show', 'full'),
      link: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-link') !== '0',
        renderHTML: () => ({}),
      },
      text: str('text', ''),
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-xref]' }]
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, string>
    const el = document.createElement('span')
    el.setAttribute('data-jan-xref', '1')
    el.setAttribute('data-kind', String(a.kind || 'heading'))
    el.setAttribute('data-target', String(a.targetId || ''))
    if (a.targetRef) el.setAttribute('data-target-ref', String(a.targetRef))
    el.setAttribute('data-show', String(a.show || 'full'))
    if (!node.attrs.link) el.setAttribute('data-link', '0')
    el.setAttribute('data-text', String(a.text || ''))
    el.className = 'jan-xref'
    el.textContent = String(a.text || '[참조]')
    el.title = '상호 참조 — 두 번 누르면 그 자리로 간다'
    return el
  },

  addCommands() {
    return {
      insertCrossRef: ({ kind, targetId, show, link = true }) => ({ tr, commands, editor }) => {
        const target = collectTargets(editor).find((t) => t.id === targetId)
        /* 가리키는 자리에 이름표를 붙인다 (워드가 숨은 책갈피를 쓰는 것과 같다).
           반드시 지금 이 트랜잭션 안에서 붙여야 한다 — 따로 dispatch 하면
           만들던 트랜잭션이 헐거워져 정작 참조가 들어가지 않는다. */
        let targetRef = target?.refId
        if (target && !targetRef) {
          const node = tr.doc.nodeAt(target.pos)
          /* 캡션 줄은 이름표를 붙일 수 없는 갈래다 (문단에는 janRef 자리가 없다) —
             그런 대상은 캡션이 이미 지닌 열쇠(refKey)를 이름표로 쓴다 */
          if (node && REF_TARGET_TYPES.includes(node.type.name)) {
            targetRef = newRefId()
            tr.setNodeMarkup(target.pos, undefined, { ...node.attrs, janRef: targetRef })
          }
        }
        const page = target ? pageOfPos(editor, target.pos) : undefined
        return commands.insertContent({
          type: this.name,
          attrs: { kind, targetId, targetRef: targetRef || '', show, link, text: refText(target, show, page) },
        })
      },
    }
  },

  addProseMirrorPlugins() {
    const type = this.type
    return [
      new Plugin({
        key: refreshKey,
        /* 문서가 바뀌면 참조 글을 다시 맞춘다 — 번호가 밀려도 손댈 것이 없다 */
        appendTransaction: (trs, _old, state) => {
          if (!trs.some((tr) => tr.docChanged)) return null
          if (trs.some((tr) => tr.getMeta(refreshKey))) return null
          let has = false
          state.doc.descendants((n) => { if (n.type === type) has = true })
          if (!has) return null

          const editor = this.editor
          const targets = collectTargets(editor, state.doc) // 갓 바뀐 문서로 번호를 다시 센다
          let tr = null as null | ReturnType<typeof state.tr.setNodeMarkup>
          state.doc.descendants((node, pos) => {
            if (node.type !== type) return
            const target = findTarget(targets, node.attrs.targetRef || undefined, node.attrs.targetId)
            const page = target ? pageOfPos(editor, target.pos) : undefined
            const next = refText(target, (node.attrs.show as RefShow) || 'full', page)
            if (next === node.attrs.text) return
            tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, text: next })
          })
          if (!tr) return null
          ;(tr as { setMeta: (k: unknown, v: unknown) => void }).setMeta(refreshKey, true)
          ;(tr as { setMeta: (k: unknown, v: unknown) => void }).setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})
