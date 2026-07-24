import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janSuperscript: {
      toggleSuperscript: () => ReturnType
    }
  }
}

/**
 * 위 첨자 마크 — 각주 참조(.paper-fn-ref)와 인용(.paper-cite)이 스키마에서 살아남게 한다.
 * (StarterKit 에는 superscript 가 없어서, 이 마크 없이는 <sup> 이 통째로 벗겨진다)
 */
export const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('class'),
        renderHTML: (attrs: { class?: string | null }) => (attrs.class ? { class: attrs.class } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'sup' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    }
  },
})
