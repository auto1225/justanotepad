import { Extension } from '@tiptap/core'

/**
 * TextStyle 마크에 textShadow 속성을 추가 — 글자 효과(그림자/네온/음각)를
 * 선택 영역 단위로 적용. FontFamily/FontSize 와 같은 방식(글로벌 textStyle 속성).
 */
export const TextShadow = Extension.create({
  name: 'textShadow',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          textShadow: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.textShadow || null,
            renderHTML: (attrs: { textShadow?: string | null }) =>
              attrs.textShadow ? { style: `text-shadow: ${attrs.textShadow}` } : {},
          },
        },
      },
    ]
  },
})
