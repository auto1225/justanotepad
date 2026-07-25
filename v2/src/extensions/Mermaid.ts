/**
 * Phase 7 — Mermaid 다이어그램 노드.
 * 코드 블록 형태로 mermaid 코드 입력 → 렌더.
 * mermaid 라이브러리는 lazy import (~600KB).
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { errText } from '../lib/errText'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (code: string) => ReturnType
    }
  }
}


/** mermaid 를 CDN 에서 불러 쓰는 만큼만 타입을 둔다 */
interface MermaidLike {
  initialize: (o: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string }>
}
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'

let mermaidLib: MermaidLike | null = null
async function getMermaid() {
  if (mermaidLib) return mermaidLib
  const m = (await import(/* @vite-ignore */ MERMAID_CDN).catch(() => null)) as { default?: MermaidLike } | null
  if (m?.default) {
    m.default.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    mermaidLib = m.default
  }
  return mermaidLib
}

export const Mermaid = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      code: { default: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[OK]\n  B -->|No| D[Cancel]' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-mermaid': 'true',
        'data-code': node.attrs.code,
        class: 'jan-mermaid',
      }),
      node.attrs.code,
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'jan-mermaid'
      dom.dataset.mermaid = 'true'
      dom.style.cssText = 'padding:12px;background:#fafafa;border:1px solid #ddd;border-radius:6px;margin:8px 0;cursor:pointer;text-align:center;'
      dom.textContent = '다이어그램 로드 중...'

      let cancelled = false
      ;(async () => {
        const m = await getMermaid()
        if (cancelled) return
        if (!m) {
          dom.textContent = 'Mermaid 로드 실패 — 코드:\n' + node.attrs.code
          return
        }
        try {
          const id = 'mer-' + Math.random().toString(36).slice(2)
          const { svg } = await m.render(id, node.attrs.code)
          dom.innerHTML = svg
        } catch (e) {
          dom.innerHTML = `<pre style="color:red;text-align:left;">${errText(e)}\n${node.attrs.code}</pre>`
        }
      })()

      dom.addEventListener('dblclick', () => {
        const next = window.prompt('Mermaid 코드 편집:', node.attrs.code)
        if (next == null) return
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        editor.chain().focus().setNodeSelection(pos).updateAttributes('mermaid', { code: next }).run()
      })

      return {
        dom,
        destroy() {
          cancelled = true
        },
      }
    }
  },

  addCommands() {
    return {
      setMermaid:
        (code: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { code } }),
    }
  },
})
