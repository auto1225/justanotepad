import { Extension, Mark, mergeAttributes } from '@tiptap/core'

/**
 * 문단·글자에 붙는 「이 스타일이다」 라는 표.
 *
 * 여기에는 서식 값이 하나도 들어 있지 않다 — 스타일 이름(id)만 있다.
 * 값은 lib/docStyles.ts 의 정의 한 곳에만 살고, CSS 한 장으로 내려온다.
 * 그래야 정의를 고칠 때 문서를 건드리지 않고도 표를 단 글이 모두 함께 바뀐다.
 *
 * 왜 굳이 스키마에 등록하는가 — 등록하지 않은 속성은 저장·재파싱에서 그냥 사라진다.
 * `<p data-jan-style="본문" class="x">` 를 setContent 로 넣으면 `<p>` 만 남는 것을
 * 실물로 쟀다 (class 도 같이 날아간다). ProseMirror 스키마에 없는 것은 없는 것이다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janDocStyle: {
      /** 고른 문단들에 스타일 표를 붙인다. null 이면 뗀다 */
      setParagraphStyle: (id: string | null) => ReturnType
      /** 고른 글에 글자 스타일 표를 붙인다 */
      setCharStyle: (id: string) => ReturnType
      unsetCharStyle: () => ReturnType
    }
  }
}

/** 표를 달 수 있는 블록 — 문단과 제목 (표·목록 안의 문단도 결국 paragraph 다) */
export const STYLED_BLOCKS = ['paragraph', 'heading'] as const

export const DocStyleAttr = Extension.create({
  name: 'janDocStyle',

  addGlobalAttributes() {
    return [
      {
        types: [...STYLED_BLOCKS],
        attributes: {
          janStyle: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-style') || null,
            renderHTML: (attrs: { janStyle?: string | null }) =>
              (attrs.janStyle ? { 'data-jan-style': attrs.janStyle } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setParagraphStyle:
        (id) =>
        ({ state, commands }) => {
          const { from, to } = state.selection
          let changed = false
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!(STYLED_BLOCKS as readonly string[]).includes(node.type.name)) return
            if ((node.attrs.janStyle ?? null) === id) return
            commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, janStyle: id })
              return true
            })
            changed = true
          })
          return changed
        },
      setCharStyle:
        (id) =>
        ({ chain }) =>
          chain().setMark('janCharStyle', { id }).run(),
      unsetCharStyle:
        () =>
        ({ chain }) =>
          chain().unsetMark('janCharStyle').run(),
    }
  },
})

/**
 * 글자 스타일 — 문단 하나가 아니라 낱말 몇 개에 붙는다 (워드 「문자 스타일」).
 * 마크로 두어야 한 문단 안에서 부분만 표를 달 수 있다.
 */
export const CharStyleMark = Mark.create({
  name: 'janCharStyle',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-cstyle'),
        renderHTML: (attrs: { id?: string | null }) => (attrs.id ? { 'data-jan-cstyle': attrs.id } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-cstyle]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },
})
