import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { CellSelection } from 'prosemirror-tables'

/**
 * 칸 왼쪽 가장자리를 눌러 그 칸 하나를 고른다 — 워드의 대표 동작.
 *
 * 워드는 칸 왼쪽 안쪽 끝에 마우스를 대면 화살표가 바뀌고, 누르면 그 칸이 통째로
 * 선택된다. 끌면 이어지는 칸들이 함께 선택된다. 우리도 같은 자리에 같은 일을 둔다.
 * (키보드로는 Alt+S, 마우스로는 세 번 클릭으로도 같은 일을 할 수 있다)
 */

/** 칸 왼쪽 끝에서 이만큼 안쪽까지가 「고르는 자리」 */
const EDGE = 8

export const CellPickEdge = Extension.create({
  name: 'janCellPickEdge',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('janCellPickEdge'),
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (event.button !== 0 || event.shiftKey || event.altKey) return false
              const target = event.target as HTMLElement | null
              const cell = target?.closest?.('td, th') as HTMLElement | null
              if (!cell || !view.dom.contains(cell)) return false

              const box = cell.getBoundingClientRect()
              if (event.clientX - box.left > EDGE) return false

              const pos = view.posAtDOM(cell, 0)
              if (pos == null || pos < 0) return false
              const $cell = view.state.doc.resolve(pos - 1)
              if (!/^table(Cell|Header)$/.test($cell.nodeAfter?.type.name || '')) return false

              event.preventDefault()
              view.dispatch(view.state.tr.setSelection(new CellSelection($cell, $cell)))
              view.focus()
              return true
            },
          },
        },
      }),
    ]
  },
})
