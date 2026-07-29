import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * 색인·근거 표시 — 글자에 붙는 표식.
 *
 * 문서 구조에 없는 <span> 으로 넣으면 저장할 때 벗겨진다. 그래서 진짜 마크로 만든다.
 * 색인은 「이 말을 색인에 넣어라」, 근거는 「이 말은 법령·판례다」 라는 표시다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janRefMarks: {
      setIndexEntry: (term: string) => ReturnType
      unsetIndexEntry: () => ReturnType
      setAuthority: (label: string, kind: string) => ReturnType
      unsetAuthority: () => ReturnType
    }
  }
}

export const IndexMark = Mark.create({
  name: 'janIndex',
  inclusive: false,

  addAttributes() {
    return {
      term: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-index') || '',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-index': String(attrs.term || '') }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-index]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'jan-index-mark' }), 0]
  },

  addCommands() {
    return {
      setIndexEntry: (term) => ({ commands }) => commands.setMark(this.name, { term }),
      unsetIndexEntry: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})

export const AuthorityMark = Mark.create({
  name: 'janAuthority',
  inclusive: false,

  addAttributes() {
    return {
      label: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-authority') || '',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-authority': String(attrs.label || '') }),
      },
      kind: {
        default: '기타',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-auth-kind') || '기타',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-auth-kind': String(attrs.kind || '기타') }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-authority]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'jan-auth-mark' }), 0]
  },

  addCommands() {
    return {
      setAuthority: (label, kind) => ({ commands }) => commands.setMark(this.name, { label, kind }),
      unsetAuthority: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})
