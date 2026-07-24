/**
 * Phase 8 — 콜아웃(callout) 노드. info / warn / tip / error 4 종류.
 * 슬래시 명령 또는 commands.setCallout('info') 로 삽입.
 */
import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export type CalloutKind = 'info' | 'warn' | 'tip' | 'error'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (kind: CalloutKind) => ReturnType
      toggleCallout: (kind: CalloutKind) => ReturnType
    }
  }
}

const ICONS: Record<CalloutKind, string> = {
  info: 'i',
  warn: '!',
  tip: '*',
  error: 'x',
}
const COLORS: Record<CalloutKind, string> = {
  info: '#1976D2',
  warn: '#F57C00',
  tip: '#388E3C',
  error: '#D32F2F',
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'info',
        parseHTML: (el) => (el.getAttribute('data-kind') as CalloutKind) || 'info',
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = (node.attrs.kind as CalloutKind) || 'info'
    const color = COLORS[kind]
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': 'true',
        class: 'jan-callout jan-callout-' + kind,
        style: `border-left:4px solid ${color}; background:color-mix(in srgb, ${color} 8%, transparent); padding:10px 14px; margin:8px 0; border-radius:6px;`,
      }),
      ['div', { class: 'jan-callout-icon', style: `color:${color}; font-weight:700; margin-bottom:4px; font-size:13px;` }, ICONS[kind] + '  ' + kind.toUpperCase()],
      ['div', { class: 'jan-callout-body' }, 0],
    ]
  },

  addCommands() {
    return {
      setCallout:
        (kind) =>
        ({ chain }) =>
          // wrapIn 만 하면 커서가 콜아웃 안에 남아 다음 입력이 계속 중첩된다 —
          // 콜아웃 뒤에 빈 문단을 만들고 거기로 커서를 옮긴다
          chain()
            .wrapIn(this.name, { kind })
            .command(({ tr, state, dispatch }) => {
              const { $from } = state.selection
              // 콜아웃 노드의 문서 내 끝 위치 뒤에 문단 삽입
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === this.name) {
                  const after = $from.after(d)
                  if (dispatch) {
                    const para = state.schema.nodes.paragraph.create()
                    tr.insert(after, para)
                    tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1)))
                  }
                  return true
                }
              }
              return true
            })
            .run(),
      toggleCallout:
        (kind) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { kind }),
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({ find: /^>!\s$/, type: this.type, getAttributes: () => ({ kind: 'warn' }) }),
      wrappingInputRule({ find: /^>i\s$/, type: this.type, getAttributes: () => ({ kind: 'info' }) }),
      wrappingInputRule({ find: /^>\*\s$/, type: this.type, getAttributes: () => ({ kind: 'tip' }) }),
      wrappingInputRule({ find: /^>x\s$/, type: this.type, getAttributes: () => ({ kind: 'error' }) }),
    ]
  },
})
