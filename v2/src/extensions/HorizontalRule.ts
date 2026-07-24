import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { mergeAttributes } from '@tiptap/core'

/**
 * 페이지 구분용 hr 과 충돌하지 않는 일반 구분선.
 * variant 속성(solid/dashed/double)을 보존해 "구분선 스타일" 메뉴가 실제로 다르게 렌더되게 한다.
 */
export const NormalHorizontalRule = HorizontalRule.extend({
  addAttributes() {
    return {
      variant: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-variant'),
        renderHTML: (attrs: { variant?: string | null }) =>
          attrs.variant ? { 'data-variant': attrs.variant, class: 'jan-hr-' + attrs.variant } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'hr:not(.jan-page-break):not([data-page-break])' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },
})
