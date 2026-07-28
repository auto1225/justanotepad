/**
 * Phase 7 — KaTeX 수식 노드.
 * 인라인 입력: $$x^2 + y^2 = z^2$$ → 렌더링.
 * 더블클릭 → 편집 모드.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'
import 'katex/dist/katex.min.css'
// 화학식 지원 (\ce{H2O}) — KaTeX mhchem 확장
import 'katex/contrib/mhchem'

export interface MathOptions {
  HTMLAttributes: Record<string, string>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      setMath: (latex: string) => ReturnType
    }
  }
}

export const MathInline = Node.create<MathOptions>({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
      /* 표시(display) 조판인가 — 번호 수식처럼 한 줄을 차지하는 수식은 여기에 해당한다.
         KaTeX 는 본문 속 수식(text style)에서 분수를 작게·바짝 붙여 그린다.
         그대로 두면 분수선에 글자가 닿고 기호 사이가 답답해 읽기 어렵다. */
      display: {
        default: false,
        parseHTML: (el) => {
          if (el.getAttribute('data-math') === 'block') return true
          // 예전 문서: 번호 수식 문단 안에 있으면 표시 조판으로 올려 준다
          return !!el.parentElement?.closest?.('[data-paper-block="eq"]')
        },
        renderHTML: () => ({}),
      },
    }
  },

  addOptions() {
    return { HTMLAttributes: {} }
  },

  parseHTML() {
    return [{ tag: 'span[data-math]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    let html: string
    try {
      html = katex.renderToString(node.attrs.latex || '', { throwOnError: false, output: 'html', displayMode: !!node.attrs.display })
    } catch {
      html = `<span style="color:red">${node.attrs.latex}</span>`
    }
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-math': node.attrs.display ? 'block' : 'inline',
        'data-latex': node.attrs.latex,
        class: node.attrs.display ? 'jan-math-inline is-display' : 'jan-math-inline',
      }),
      ['span', { class: 'jan-math-rendered', innerHTML: html } as unknown as Record<string, string>],
    ]
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement('span')
      dom.className = node.attrs.display ? 'jan-math-inline is-display' : 'jan-math-inline'
      dom.dataset.math = node.attrs.display ? 'block' : 'inline'
      dom.dataset.latex = node.attrs.latex
      try {
        dom.innerHTML = katex.renderToString(node.attrs.latex || '', { throwOnError: false, displayMode: !!node.attrs.display })
      } catch {
        dom.textContent = node.attrs.latex
      }
      dom.addEventListener('dblclick', () => {
        // 수식 스튜디오에서 편집 (Toolbar 가 이벤트를 받아 모달을 연다)
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos == null) return
        window.dispatchEvent(new CustomEvent('jan-math-edit', { detail: { latex: node.attrs.latex as string, pos } }))
      })
      return { dom }
    }
  },

  addCommands() {
    return {
      setMath:
        (latex: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    }
  },
})
