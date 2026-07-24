import { Extension } from '@tiptap/core'

/**
 * 워드식 문단 들여쓰기/내어쓰기.
 * paragraph·heading 에 indent(0~8) 속성을 부여하고 margin-left 로 렌더.
 * 리스트 들여쓰기(Tab)와는 별개 — 버튼/명령으로만 동작시켜 충돌을 피한다.
 */
const MAX_INDENT = 8
const INDENT_PX = 24

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janIndent: {
      indentParagraph: () => ReturnType
      outdentParagraph: () => ReturnType
      /** 문단(블록) 단위 줄 간격 — 내장 LineHeight 는 마크 기반이라 워드식 문단 간격에 부적합 */
      setParagraphLineHeight: (lineHeight: string | null) => ReturnType
    }
  }
}

export const Indent = Extension.create({
  name: 'janIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el: HTMLElement) => {
              const explicit = parseInt(el.getAttribute('data-indent') || '', 10)
              if (!Number.isNaN(explicit)) return Math.min(MAX_INDENT, Math.max(0, explicit))
              const ml = parseInt(el.style.marginLeft || '', 10)
              if (!Number.isNaN(ml) && ml > 0) return Math.min(MAX_INDENT, Math.round(ml / INDENT_PX))
              return 0
            },
            renderHTML: (attrs: { indent?: number }) => {
              const level = attrs.indent || 0
              if (!level) return {}
              return { 'data-indent': String(level), style: `margin-left: ${level * INDENT_PX}px;` }
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: { lineHeight?: string | null }) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight};` } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    const adjust = (delta: number) =>
      () =>
      ({ state, commands }: { state: import('@tiptap/pm/state').EditorState; commands: import('@tiptap/core').SingleCommands }) => {
        const { from, to } = state.selection
        let changed = false
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === 'paragraph' || node.type.name === 'heading') {
            const current = (node.attrs.indent as number) || 0
            const next = Math.min(MAX_INDENT, Math.max(0, current + delta))
            if (next !== current) {
              commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next })
                return true
              })
              changed = true
            }
          }
        })
        return changed
      }
    return {
      indentParagraph: adjust(1),
      outdentParagraph: adjust(-1),
      setParagraphLineHeight:
        (lineHeight: string | null) =>
        ({ state, commands }: { state: import('@tiptap/pm/state').EditorState; commands: import('@tiptap/core').SingleCommands }) => {
          const { from, to } = state.selection
          let changed = false
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight })
                return true
              })
              changed = true
            }
          })
          return changed
        },
    }
  },
})
