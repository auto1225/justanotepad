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
      /** 눈금자에서 끌어 쓰는 문단 여백 — 왼쪽 들여쓰기(px, 24 단위로 맞춤) */
      setParagraphIndentPx: (px: number) => ReturnType
      /** 첫 줄 들여쓰기/내어쓰기(px, 음수면 내어쓰기) */
      setParagraphFirstLine: (px: number) => ReturnType
      /** 오른쪽 들여쓰기(px) */
      setParagraphIndentRight: (px: number) => ReturnType
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
          /* 눈금자에서 끌어 조절하는 문단 여백 — 워드·한글의 첫 줄/오른쪽 들여쓰기 */
          firstLine: {
            default: 0,
            parseHTML: (el: HTMLElement) => Math.round(parseFloat(el.style.textIndent || '0')) || 0,
            renderHTML: (attrs: { firstLine?: number }) =>
              attrs.firstLine ? { style: `text-indent: ${attrs.firstLine}px;` } : {},
          },
          /* 단락 앞·뒤 공백 — 워드 「단락 앞에 공백 추가/제거」 */
          spaceBefore: {
            default: null,
            parseHTML: (el: HTMLElement) => Math.round(parseFloat(el.style.marginTop || '0')) || null,
            renderHTML: (attrs: { spaceBefore?: number | null }) =>
              attrs.spaceBefore ? { style: `margin-top: ${attrs.spaceBefore}px;` } : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (el: HTMLElement) => Math.round(parseFloat(el.style.marginBottom || '0')) || null,
            renderHTML: (attrs: { spaceAfter?: number | null }) =>
              attrs.spaceAfter ? { style: `margin-bottom: ${attrs.spaceAfter}px;` } : {},
          },
          /* 단락 음영·테두리 — 워드 「단락」 묶음의 음영·테두리 */
          shading: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-shading'),
            renderHTML: (attrs: { shading?: string | null }) =>
              attrs.shading
                ? { 'data-shading': attrs.shading, style: `background-color: ${attrs.shading}; padding: 2px 6px;` }
                : {},
          },
          border: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-para-border'),
            renderHTML: (attrs: { border?: string | null }) => {
              const where = attrs.border
              if (!where) return {}
              const line = '1px solid #98a2b3'
              const css = where === 'all'
                ? `border: ${line}; padding: 4px 8px;`
                : `border-${where}: ${line}; padding: 4px 8px;`
              return { 'data-para-border': where, style: css }
            },
          },
          indentRight: {
            default: 0,
            parseHTML: (el: HTMLElement) => Math.round(parseFloat(el.style.marginRight || '0')) || 0,
            renderHTML: (attrs: { indentRight?: number }) =>
              attrs.indentRight ? { style: `margin-right: ${attrs.indentRight}px;` } : {},
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
    /** 선택 범위의 문단 속성을 한 번에 바꾼다 (눈금자 끌기용) */
    const setAttr = (key: 'indent' | 'firstLine' | 'indentRight', clamp: (v: number) => number) =>
      (value: number) =>
      ({ state, commands }: { state: import('@tiptap/pm/state').EditorState; commands: import('@tiptap/core').SingleCommands }) => {
        const next = clamp(value)
        const { from, to } = state.selection
        let changed = false
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return
          if ((node.attrs[key] || 0) === next) return
          commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, [key]: next })
            return true
          })
          changed = true
        })
        return changed
      }

    return {
      indentParagraph: adjust(1),
      outdentParagraph: adjust(-1),
      // 왼쪽 들여쓰기는 단계(24px) 모델이라 가장 가까운 단계로 맞춘다
      setParagraphIndentPx: setAttr('indent', (px) =>
        Math.min(MAX_INDENT, Math.max(0, Math.round(px / INDENT_PX)))
      ),
      setParagraphFirstLine: setAttr('firstLine', (px) => Math.round(Math.max(-200, Math.min(200, px)))),
      setParagraphIndentRight: setAttr('indentRight', (px) => Math.round(Math.max(0, Math.min(600, px)))),
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
