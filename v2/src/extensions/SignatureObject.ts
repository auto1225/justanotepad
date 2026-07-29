import { Node } from '@tiptap/core'

/**
 * 서명란 — 워드 「삽입 › 서명란」.
 *
 * 워드는 서명하려면 디지털 인증서가 있어야 하지만, 우리는 그 자리에서
 * 손으로 그리거나 이름을 적어 서명할 수 있다 (문서에 그림으로 담긴다).
 * 인증서 서명이 필요한 곳에서는 이 칸을 인쇄해 손으로 적는 자리로도 쓴다.
 */

export interface SignatureAttrs {
  signer: string
  title: string
  email: string
  instruction: string
  showDate: boolean
  signedName: string
  signedImage: string
  signedAt: string
  width: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janSignature: {
      insertSignature: (attrs?: Partial<SignatureAttrs>) => ReturnType
      updateSignature: (attrs: Partial<SignatureAttrs>) => ReturnType
    }
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const SignatureObject = Node.create({
  name: 'janSignature',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    const str = (name: string, def = '') => ({
      default: def,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) || def,
      renderHTML: () => ({}),
    })
    return {
      signer: str('signer'),
      title: str('title'),
      email: str('email'),
      instruction: str('instruction', '이 문서에 서명하기 전에 내용을 확인하십시오.'),
      showDate: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-show-date') !== '0',
        renderHTML: () => ({}),
      },
      signedName: str('signed-name'),
      signedImage: str('signed-image'),
      signedAt: str('signed-at'),
      width: {
        default: 320,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-w')) || 320,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-jan-signature]' }]
  },

  renderHTML({ node }) {
    const a = node.attrs as unknown as SignatureAttrs
    const el = document.createElement('div')
    el.setAttribute('data-jan-signature', '1')
    el.setAttribute('data-signer', a.signer || '')
    el.setAttribute('data-title', a.title || '')
    el.setAttribute('data-email', a.email || '')
    el.setAttribute('data-instruction', a.instruction || '')
    el.setAttribute('data-show-date', a.showDate ? '1' : '0')
    if (a.signedName) el.setAttribute('data-signed-name', a.signedName)
    if (a.signedImage) el.setAttribute('data-signed-image', a.signedImage)
    if (a.signedAt) el.setAttribute('data-signed-at', a.signedAt)
    el.setAttribute('data-w', String(a.width || 320))
    el.className = 'jan-signature'
    el.style.cssText = `display:inline-block;width:${Math.max(180, Math.min(560, a.width || 320))}px;margin:12px 0;`

    const mark = a.signedImage
      ? `<img src="${esc(a.signedImage)}" alt="서명" style="max-height:44px;display:block;margin:0 auto 2px">`
      : a.signedName
        ? `<div style="font-family:'Segoe Script','Apple Chancery',cursive;font-size:20px;text-align:center;margin-bottom:2px">${esc(a.signedName)}</div>`
        : '<div style="height:44px"></div>'

    el.innerHTML =
      mark +
      '<div style="border-top:1px solid #1c1f26;padding-top:4px;font-size:9.5pt;line-height:1.5">' +
      `<div><strong>${esc(a.signer || '서명인')}</strong>${a.title ? ' · ' + esc(a.title) : ''}</div>` +
      (a.email ? `<div style="color:#6b7684">${esc(a.email)}</div>` : '') +
      (a.showDate ? `<div style="color:#6b7684">날짜: ${esc(a.signedAt || '')}${a.signedAt ? '' : '&nbsp;'}</div>` : '') +
      (a.instruction ? `<div style="color:#98a2b3;font-size:8.5pt;margin-top:2px">${esc(a.instruction)}</div>` : '') +
      '</div>'
    return el
  },

  addCommands() {
    return {
      insertSignature: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs: attrs || {} }),
      updateSignature: (attrs) => ({ commands }) => commands.updateAttributes(this.name, attrs),
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false
        window.dispatchEvent(new CustomEvent('jan-signature-dialog', { detail: { mode: 'sign' } }))
        return true
      },
    }
  },
})
