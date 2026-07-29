import { Node } from '@tiptap/core'
import { DEFAULT_CHART, chartSvg } from '../lib/chartSpec'
import type { ChartSpec } from '../lib/chartSpec'

/**
 * 차트 개체 — 워드 「삽입 › 차트」.
 *
 * 숫자를 문서 안에 함께 담고(data-spec), 그 자리에서 SVG 로 그린다.
 * 그래서 (1) 숫자를 고치면 즉시 다시 그려지고, (2) 저장한 파일을 다른 프로그램에서
 * 열어도 그림이 그대로 보인다. 워드는 엑셀을 띄우지만 우리는 문서가 스스로 지닌다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janChart: {
      insertChart: (spec?: Partial<ChartSpec>) => ReturnType
      updateChart: (spec: Partial<ChartSpec>) => ReturnType
    }
  }
}

export function readChartSpec(el: HTMLElement): ChartSpec {
  try {
    const raw = el.getAttribute('data-spec')
    if (!raw) return { ...DEFAULT_CHART }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CHART, ...parsed }
  } catch {
    return { ...DEFAULT_CHART }
  }
}

export const ChartObject = Node.create({
  name: 'janChart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      spec: {
        default: DEFAULT_CHART as ChartSpec,
        parseHTML: (el: HTMLElement) => readChartSpec(el),
        renderHTML: () => ({}),
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: () => ({}),
      },
      caption: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption') || '',
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-jan-chart]' }, { tag: 'div[data-jan-chart]' }]
  },

  renderHTML({ node }) {
    const spec = (node.attrs.spec as ChartSpec) || DEFAULT_CHART
    const align = (node.attrs.align as string) || 'center'
    const caption = (node.attrs.caption as string) || ''
    const el = document.createElement('figure')
    el.setAttribute('data-jan-chart', '1')
    el.setAttribute('data-spec', JSON.stringify(spec))
    el.setAttribute('data-align', align)
    if (caption) el.setAttribute('data-caption', caption)
    el.className = 'jan-chart'
    el.style.cssText = `margin:10px 0;text-align:${align};`
    el.innerHTML = chartSvg(spec) + (caption
      ? `<figcaption style="font-size:9pt;color:#6b7684;text-align:center;margin-top:4px">${caption.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c])}</figcaption>`
      : '')
    return el
  },

  addCommands() {
    return {
      insertChart: (spec) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { spec: { ...DEFAULT_CHART, ...spec } } }),
      updateChart: (spec) => ({ commands, editor }) => {
        const cur = (editor.getAttributes(this.name).spec as ChartSpec) || DEFAULT_CHART
        return commands.updateAttributes(this.name, { spec: { ...cur, ...spec } })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      // 차트를 고르고 Enter — 워드에서 개체를 두 번 누르는 것과 같다
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false
        window.dispatchEvent(new CustomEvent('jan-chart-dialog', { detail: { mode: 'edit' } }))
        return true
      },
    }
  },
})
