import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

/** 셀 배경색 속성 — 워드식 표 음영. setCellAttribute('backgroundColor', ...) 로 적용 */
const backgroundColorAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
    renderHTML: (attrs: { backgroundColor?: string | null }) =>
      attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {},
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
const TABLE_PROP_KEYS = ['data-fit', 'data-align', 'data-place', 'data-width'] as const

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
              if (node.type.name !== 'table') return true
              const attrs: Record<string, string> = {}
              for (const key of TABLE_PROP_KEYS) {
                const value = node.attrs[key]
                if (value) attrs[key] = String(value)
              }
              // 너비는 CSS 변수로 넘긴다 — 껍데기가 아니라 안쪽 표에 물려야 하기 때문이다
              if (attrs['data-width']) attrs.style = `--jan-table-w:${attrs['data-width']}`
              if (Object.keys(attrs).length) decos.push(Decoration.node(pos, pos + node.nodeSize, attrs))
              return false
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
        types: ['table'],
        attributes: {
          'data-fit': attr('data-fit'),
          'data-align': attr('data-align'),
          'data-place': attr('data-place'),
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
