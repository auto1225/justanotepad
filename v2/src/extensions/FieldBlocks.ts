import { Extension } from '@tiptap/core'

/**
 * 심어 둔 목록 표시 — 목차·색인·참고 문헌처럼 「우리가 만들어 넣은 줄」에 붙는 이름표.
 *
 * 워드는 이런 것을 필드로 심어 F9 로 새로 고친다. 우리는 만든 줄마다 data-jan-field 를
 * 달아 두고, 「고쳐 넣기」 를 누르면 같은 이름표를 가진 줄만 걷어 내고 다시 만든다.
 * (감싸는 div 로 하려 했지만 문서 구조에 div 가 없어 저장할 때 벗겨진다 — 줄에 붙여야 남는다)
 */

export const FIELD_TYPES = ['paragraph', 'heading']

export const FieldBlocks = Extension.create({
  name: 'janFieldBlocks',
  addGlobalAttributes() {
    return [
      {
        types: FIELD_TYPES,
        attributes: {
          janField: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-field') || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              (attrs.janField ? { 'data-jan-field': String(attrs.janField) } : {}),
          },
        },
      },
    ]
  },
})
