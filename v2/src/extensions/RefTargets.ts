import { Extension } from '@tiptap/core'

/**
 * 참조 표식 — 상호 참조가 가리키는 자리에 몰래 붙는 이름표.
 *
 * "몇 번째 표" 로 가리키면 앞에 표가 하나 끼어드는 순간 엉뚱한 것을 가리키게 된다.
 * 그래서 워드가 숨은 책갈피를 쓰듯, 우리도 대상 노드에 지워지지 않는 이름표(janRef)를 붙이고
 * 번호는 그때그때 다시 센다. 이름표는 저장본에도 남아 문서를 다시 열어도 이어진다.
 */

export const REF_TARGET_TYPES = ['heading', 'table', 'image', 'janImage', 'janChart', 'janSmart']

export const RefTargets = Extension.create({
  name: 'janRefTargets',
  addGlobalAttributes() {
    return [
      {
        types: REF_TARGET_TYPES,
        attributes: {
          janRef: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-ref') || null,
            renderHTML: (attrs: Record<string, unknown>) => (attrs.janRef ? { 'data-jan-ref': String(attrs.janRef) } : {}),
          },
        },
      },
    ]
  },
})

/** 새 이름표 하나 — 짧고 겹치지 않게 */
export function newRefId(): string {
  return 'r' + Math.random().toString(36).slice(2, 9)
}
