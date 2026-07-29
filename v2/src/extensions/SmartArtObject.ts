import { Node } from '@tiptap/core'
import { DEFAULT_SMART, smartSvg } from '../lib/smartArt'
import type { SmartSpec } from '../lib/smartArt'

/**
 * 스마트 도해 개체 — 워드 「삽입 › SmartArt」.
 * 글 목록과 배치 이름만 담고, 그림은 그때그때 그린다 (항목을 고치면 자리가 다시 잡힌다).
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janSmart: {
      insertSmartArt: (spec?: Partial<SmartSpec>) => ReturnType
      updateSmartArt: (spec: Partial<SmartSpec>) => ReturnType
    }
  }
}

function readSpec(el: HTMLElement): SmartSpec {
  try {
    const raw = el.getAttribute('data-spec')
    return raw ? { ...DEFAULT_SMART, ...JSON.parse(raw) } : { ...DEFAULT_SMART }
  } catch {
    return { ...DEFAULT_SMART }
  }
}

export const SmartArtObject = Node.create({
  name: 'janSmart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      spec: {
        default: DEFAULT_SMART as SmartSpec,
        parseHTML: (el: HTMLElement) => readSpec(el),
        renderHTML: () => ({}),
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-jan-smart]' }, { tag: 'div[data-jan-smart]' }]
  },

  renderHTML({ node }) {
    const spec = (node.attrs.spec as SmartSpec) || DEFAULT_SMART
    const el = document.createElement('figure')
    el.setAttribute('data-jan-smart', '1')
    el.setAttribute('data-spec', JSON.stringify(spec))
    el.setAttribute('data-align', String(node.attrs.align || 'center'))
    el.className = 'jan-smart'
    el.style.cssText = `margin:10px 0;text-align:${String(node.attrs.align || 'center')};`
    el.innerHTML = smartSvg(spec)
    return el
  },

  addCommands() {
    return {
      insertSmartArt: (spec) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { spec: { ...DEFAULT_SMART, ...spec } } }),
      updateSmartArt: (spec) => ({ commands, editor }) => {
        const cur = (editor.getAttributes(this.name).spec as SmartSpec) || DEFAULT_SMART
        return commands.updateAttributes(this.name, { spec: { ...cur, ...spec } })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false
        window.dispatchEvent(new CustomEvent('jan-smart-dialog', { detail: { mode: 'edit' } }))
        return true
      },
    }
  },
})
