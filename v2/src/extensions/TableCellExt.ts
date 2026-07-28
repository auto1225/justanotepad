import { Extension } from '@tiptap/core'
import { applyFormulas } from '../lib/tableCompute'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

/** 셀 속성 — 워드식 표 음영·세로 맞춤·수식. setCellAttribute(...) 로 적용 */
const backgroundColorAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
    renderHTML: (attrs: { backgroundColor?: string | null }) =>
      attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
  },
  /** 세로 맞춤 — 워드의 「셀 맞춤」 위·가운데·아래 */
  valign: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-valign'),
    renderHTML: (attrs: { valign?: string | null }) =>
      attrs.valign ? { 'data-valign': attrs.valign } : {},
  },
  /** 칸 수식 — 워드의 「수식(fx)」. 값은 계산해서 칸 글자로 넣는다 */
  formula: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-formula'),
    renderHTML: (attrs: { formula?: string | null }) =>
      attrs.formula ? { 'data-formula': attrs.formula } : {},
  },
  /** 수식 결과의 번호 형식 (#,##0.00 등) */
  numFormat: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-num-format'),
    renderHTML: (attrs: { numFormat?: string | null }) =>
      attrs.numFormat ? { 'data-num-format': attrs.numFormat } : {},
  },
}

export const JanTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttr }
  },
})

export const JanTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttr }
  },
})

/**
 * 표 속성 — 워드의 「표 속성」 대화상자에 맞춘 값들.
 *
 *  fit    자동 맞춤: 'window' 창(단)에 맞춤(기본) | 'contents' 내용에 맞춤 | 'fixed' 고정 열 너비
 *  width  표 너비 (예: '60%', '80mm'). 비어 있으면 자동 맞춤 값을 따른다
 *  align  표 정렬: 'left'(기본) | 'center' | 'right'
 *  place  다단 문서에서의 자리: 'column' 단 안 | 'page' 단 걸치기(지면 전체 폭) | null 자동
 *         (워드에는 없는 항목이지만 2단 논문 조판에는 반드시 필요하다)
 */
const TABLE_PROP_KEYS = ['data-fit', 'data-align', 'data-place', 'data-width', 'data-style', 'data-first-col', 'data-last-row', 'data-cell-pad'] as const

/**
 * 칸 수식 자동 계산 — 표가 바뀔 때마다 결과를 다시 써넣는다.
 * (워드는 F9 를 눌러야 하지만, 고치는 동안 바로 보이는 편이 낫다)
 */
export const TableFormulaAuto = Extension.create({
  name: 'janTableFormulaAuto',
  addProseMirrorPlugins() {
    const key = new PluginKey('janTableFormulaAuto')
    return [
      new Plugin({
        key,
        appendTransaction(trs, _oldState, newState) {
          if (!trs.some((tr) => tr.docChanged)) return null
          // 계산이 만든 트랜잭션에 다시 반응하면 끝없이 돈다
          if (trs.some((tr) => tr.getMeta(key))) return null
          const tr = newState.tr
          const changed = applyFormulas(tr)
          if (!changed) return null
          tr.setMeta(key, true)
          tr.setMeta('addToHistory', false)
          return tr
        },
      }),
    ]
  },
})

export const TablePlacement = Extension.create({
  name: 'janTableProps',

  /* 표는 열 너비 조절 때문에 스스로 DOM 을 만드는 노드뷰를 쓴다 —
     그래서 renderHTML 로 붙인 속성이 화면에 닿지 않는다.
     데코레이션은 노드뷰가 만든 DOM 에도 그대로 얹히므로 이 길로 내보낸다. */
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('janTablePropsDeco'),
        props: {
          decorations(state) {
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'tableRow' && node.attrs['data-height']) {
                decos.push(Decoration.node(pos, pos + node.nodeSize, {
                  'data-height': String(node.attrs['data-height']),
                  style: `height:${node.attrs['data-height']}`,
                }))
                return false
              }
              if (node.type.name !== 'table') return true
              const attrs: Record<string, string> = {}
              for (const key of TABLE_PROP_KEYS) {
                const value = node.attrs[key]
                if (value) attrs[key] = String(value)
              }
              // 너비는 CSS 변수로 넘긴다 — 껍데기가 아니라 안쪽 표에 물려야 하기 때문이다
              const styles: string[] = []
              if (attrs['data-width']) styles.push(`--jan-table-w:${attrs['data-width']}`)
              if (attrs['data-cell-pad']) styles.push(`--jan-cell-pad:${attrs['data-cell-pad']}px`)
              if (styles.length) attrs.style = styles.join(';')
              if (Object.keys(attrs).length) decos.push(Decoration.node(pos, pos + node.nodeSize, attrs))
              return true // 표 안의 행도 살펴야 한다 (행 높이)
            })
            return decos.length ? DecorationSet.create(state.doc, decos) : null
          },
        },
      }),
    ]
  },
  addGlobalAttributes() {
    const attr = (name: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(name),
      renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [name]: attrs[name] } : {}),
    })
    return [
      {
        types: ['tableRow'],
        attributes: { 'data-height': attr('data-height') },
      },
      {
        types: ['table'],
        attributes: {
          'data-fit': attr('data-fit'),
          'data-align': attr('data-align'),
          'data-place': attr('data-place'),
          'data-style': attr('data-style'),
          'data-first-col': attr('data-first-col'),
          'data-last-row': attr('data-last-row'),
          'data-cell-pad': attr('data-cell-pad'),
          'data-width': {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-width'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs['data-width'] ? { 'data-width': attrs['data-width'], style: `width:${attrs['data-width']}` } : {},
          },
        },
      },
    ]
  },
})
