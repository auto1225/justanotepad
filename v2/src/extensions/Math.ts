/**
 * Phase 7 — KaTeX 수식 노드.
 * 인라인 입력: $$x^2 + y^2 = z^2$$ → 렌더링.
 * 더블클릭 → 편집 모드.
 *
 * 화면은 노드 뷰가 그리고(KaTeX HTML), 저장·인쇄·내보내기는 renderHTML 이 그린다.
 * 그 둘이 갈라져 있어서 오래 눈에 띄지 않은 고장이 둘 있었다 — 아래 주석 참고.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'
import 'katex/dist/katex.min.css'
// 화학식 지원 (\ce{H2O}) — KaTeX mhchem 확장
import 'katex/contrib/mhchem'
import { sanitizeUntrustedHtml } from '../lib/sanitizeHtml'

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

/** 이 요소가 이미 수식 노드 안(또는 KaTeX 가 만든 속살)인가 */
function insideMath(el: HTMLElement): boolean {
  return !!el.parentElement?.closest?.('[data-math], .katex')
}

/** LaTeX → MathML 한 조각. 글꼴·CSS 없이 브라우저가 그대로 그린다. */
function latexToMathml(latex: string, display: boolean): string {
  if (!latex) return ''
  try {
    const html = katex.renderToString(latex, { throwOnError: false, output: 'mathml', displayMode: display })
    // KaTeX 는 <span class="katex"><span class="katex-mathml"><math>…</math></span></span> 로 감싼다.
    // 그 껍데기는 KaTeX CSS 가 있어야 뜻이 있으므로(인쇄본에는 없다) 알맹이 <math> 만 꺼낸다.
    const holder = document.createElement('span')
    holder.innerHTML = html
    /* KaTeX 는 <semantics> 안에 원문 LaTeX 를 <annotation> 으로 함께 담는다.
       살균기가 그 두 태그를 지우면서 **속의 글자는 남기므로**, 그대로 두면
       인쇄본에 수식 옆에 「\frac{a+b}{c+d}」 라는 날 글자가 따라 나온다. */
    holder.querySelectorAll('annotation').forEach((a) => a.remove())
    return holder.querySelector('math')?.outerHTML || ''
  } catch {
    return ''
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
      /* 밖에서 붙여넣은 MathML 을 그대로 담아 둔다.
         예전에는 <math> 를 아무도 맡지 않아 편집기가 속의 글자만 주워 담았다 —
         분수 a+b/c+d 가 「a+bc+d」 라는 **틀린 글**이 되어 조용히 남았다.
         LaTeX 로 옮겨 적을 길이 없으니(KaTeX 는 LaTeX 만 읽는다) 원문을 지킨다. */
      mathml: {
        default: '',
        parseHTML: () => null, // 아래 parseHTML 의 getAttrs 가 채운다
        renderHTML: () => ({}),
      },
      /* 표시(display) 조판인가 — 번호 수식처럼 한 줄을 차지하는 수식은 여기에 해당한다.
         KaTeX 는 본문 속 수식(text style)에서 분수를 작게·바짝 붙여 그린다.
         그대로 두면 분수선에 글자가 닿고 기호 사이가 답답해 읽기 어렵다. */
      display: {
        default: false,
        parseHTML: (el) => {
          if (el.getAttribute('data-math') === 'block') return true
          if (el.tagName.toLowerCase() === 'math' && el.getAttribute('display') === 'block') return true
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
    return [
      {
        tag: 'span[data-math]',
        getAttrs: (el) => {
          const node = el as HTMLElement
          const latex = node.getAttribute('latex') || node.getAttribute('data-latex') || ''
          // LaTeX 가 없는 수식(= 붙여넣은 MathML)만 원문을 챙긴다
          if (latex) return null
          const math = node.querySelector('math')
          return math ? { mathml: math.outerHTML } : null
        },
      },
      {
        /* 밖에서 붙여넣은 맨 MathML — 위키·워드·MathType 이 이 꼴로 준다.
           우리가 그린 <math>(위 span 안쪽)와 KaTeX 속살은 건드리지 않는다. */
        tag: 'math',
        getAttrs: (el) => (insideMath(el as HTMLElement) ? false : { mathml: (el as HTMLElement).outerHTML }),
      },
    ]
  },

  /**
   * 저장·인쇄·내보내기·클립보드가 쓰는 그림.
   *
   * 예전에는 `['span', { innerHTML: html }]` 로 적었다. ProseMirror 의 그림 규격에
   * innerHTML 같은 것은 없다 — 그 자리의 객체는 **속성**으로 나간다. 그래서 저장본에는
   * `innerhtml="&lt;span class=&quot;katex&quot;…"` 라는 2KB 짜리 속성만 남고 알맹이는
   * 하나도 없었다. 화면은 노드 뷰가 따로 그리니 멀쩡해 보였지만,
   *  하나. 인쇄·PDF·HTML 내보내기에서는 수식 자리가 **텅 비었다**.
   *  둘.  저장할 때마다 그 속성이 한 번 더 이스케이프되어 파일이 부풀었다.
   * 이제 진짜 DOM 을 만들어 돌려준다 (ProseMirror 의 그림 규격은 DOM 노드를 받는다).
   * 알맹이는 MathML 이다 — 브라우저가 글꼴·CSS 없이 그대로 그리므로 인쇄본에서도 산다.
   */
  renderHTML({ node, HTMLAttributes }) {
    const display = !!node.attrs.display
    const latex = String(node.attrs.latex || '')
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-math': display ? 'block' : 'inline',
      'data-latex': latex,
      class: display ? 'jan-math-inline is-display' : 'jan-math-inline',
    })
    const inner = latex ? latexToMathml(latex, display) : String(node.attrs.mathml || '')
    if (typeof document === 'undefined') return ['span', attrs, latex]
    const dom = document.createElement('span')
    Object.entries(attrs).forEach(([k, v]) => { if (v != null) dom.setAttribute(k, String(v)) })
    if (inner) dom.innerHTML = sanitizeUntrustedHtml(inner)
    else if (latex) dom.textContent = latex // MathML 로도 못 그리면 원문이라도 남긴다
    return dom
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement('span')
      dom.className = node.attrs.display ? 'jan-math-inline is-display' : 'jan-math-inline'
      dom.dataset.math = node.attrs.display ? 'block' : 'inline'
      dom.dataset.latex = node.attrs.latex
      const mathml = String(node.attrs.mathml || '')
      if (!node.attrs.latex && mathml) {
        // 붙여넣은 MathML — 브라우저가 그대로 그린다 (KaTeX 는 LaTeX 만 읽는다)
        dom.innerHTML = sanitizeUntrustedHtml(mathml)
      } else {
        try {
          dom.innerHTML = katex.renderToString(node.attrs.latex || '', { throwOnError: false, displayMode: !!node.attrs.display })
        } catch {
          dom.textContent = node.attrs.latex
        }
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
