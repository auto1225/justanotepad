import { Node, mergeAttributes } from '@tiptap/core'

/**
 * 암호화된 메모의 sentinel 노드.
 * 이 노드가 스키마에 없으면 `<div class="jan-locked" data-cipher=...>` 가 로드 시 벗겨져
 * 다음 자동저장이 암호문을 placeholder 텍스트로 덮어쓴다 — 즉 원본 영구 소실.
 * atom 노드로 보존해 어떤 편집·저장 경로에서도 암호문이 살아남게 한다.
 */
export const LockedContent = Node.create({
  name: 'lockedContent',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      iv: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-iv') || '',
        renderHTML: (attrs: { iv?: string }) => ({ 'data-iv': attrs.iv || '' }),
      },
      salt: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-salt') || '',
        renderHTML: (attrs: { salt?: string }) => ({ 'data-salt': attrs.salt || '' }),
      },
      cipher: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-cipher') || '',
        renderHTML: (attrs: { cipher?: string }) => ({ 'data-cipher': attrs.cipher || '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div.jan-locked' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'jan-locked',
        style: 'border:1px dashed rgba(0,0,0,0.25); border-radius:8px; padding:24px 16px; text-align:center; color:#888; margin:12px 0; user-select:none;',
      }),
      ['p', {}, '비밀번호로 보호된 메모입니다 — 잠금 메뉴에서 해제하세요'],
    ]
  },
})
