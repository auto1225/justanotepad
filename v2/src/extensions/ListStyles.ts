import { Extension } from '@tiptap/core'

/**
 * 목록 모양 — 워드 「글머리 기호 ▾ · 번호 매기기 ▾」 의 라이브러리.
 * 목록 노드에 모양을 적어 두고 CSS 가 그린다 (저장본에도 그대로 남는다).
 */
export const ListStyles = Extension.create({
  name: 'janListStyles',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList'],
        attributes: {
          bulletStyle: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-bullet'),
            renderHTML: (attrs: { bulletStyle?: string | null }) =>
              attrs.bulletStyle ? { 'data-bullet': attrs.bulletStyle } : {},
          },
        },
      },
      {
        types: ['orderedList'],
        attributes: {
          numberStyle: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-number'),
            renderHTML: (attrs: { numberStyle?: string | null }) =>
              attrs.numberStyle ? { 'data-number': attrs.numberStyle } : {},
          },
        },
      },
    ]
  },
})
