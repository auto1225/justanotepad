import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { currentPen, penToValue } from '../lib/tableBorders'
import { flash } from '../lib/flash'

/**
 * 표 그리기 · 지우개 · 테두리 복사 — 워드 「테이블 디자인 › 그리기」.
 *
 *  · 표 그리기: 연필을 쥔 채 칸의 변을 누르면 그 변에 선이 그어진다.
 *  · 지우개: 누른 변의 선을 지운다.
 *  · 테두리 복사: 본이 되는 칸의 테두리를 집어 다른 칸에 그대로 바른다.
 *
 * 워드처럼 「모드」 로 동작한다 — 켜 두면 계속 그릴 수 있고 Esc 로 끝낸다.
 */

export type PenMode = 'draw' | 'erase' | 'copy' | null

let mode: PenMode = null
let clipboard: Record<string, unknown> | null = null

const listeners = new Set<(m: PenMode) => void>()

export function penMode(): PenMode {
  return mode
}

/* 모드를 켠 동안에는 문서 어디서 Esc 를 눌러도 끝난다 —
   창을 닫은 뒤에는 편집기에 초점이 없을 수 있어 편집기 키 처리만으로는 못 빠져나온다 */
let escHandler: ((e: KeyboardEvent) => void) | null = null

export function setPenMode(next: PenMode): PenMode {
  mode = mode === next ? null : next
  if (escHandler) { document.removeEventListener('keydown', escHandler, true); escHandler = null }
  if (mode) {
    escHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setPenMode(null)
      clipboard = null
    }
    document.addEventListener('keydown', escHandler, true)
  }
  document.body.classList.toggle('jan-pen-draw', mode === 'draw')
  document.body.classList.toggle('jan-pen-erase', mode === 'erase')
  document.body.classList.toggle('jan-pen-copy', mode === 'copy')
  listeners.forEach((fn) => fn(mode))
  const names: Record<string, string> = {
    draw: '표 그리기 — 칸의 변을 누르면 선이 그어진다 (Esc 로 끝냄)',
    erase: '지우개 — 누른 변의 선을 지운다 (Esc 로 끝냄)',
    copy: '테두리 복사 — 본이 될 칸을 먼저 누르고, 바를 칸을 누른다 (Esc 로 끝냄)',
  }
  flash(mode ? names[mode] : '그리기를 끝냈다')
  return mode
}

export function onPenModeChange(fn: (m: PenMode) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 누른 자리가 칸의 어느 변인지 — 가장 가까운 변을 고른다 */
function sideAt(cell: HTMLElement, x: number, y: number): 'top' | 'right' | 'bottom' | 'left' {
  const r = cell.getBoundingClientRect()
  const d = {
    top: Math.abs(y - r.top),
    bottom: Math.abs(r.bottom - y),
    left: Math.abs(x - r.left),
    right: Math.abs(r.right - x),
  }
  return (Object.keys(d) as (keyof typeof d)[]).reduce((a, b) => (d[a] <= d[b] ? a : b))
}

const ATTR = { top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft' } as const
const BORDER_KEYS = ['borderTop', 'borderRight', 'borderBottom', 'borderLeft'] as const

export const TablePen = Extension.create({
  name: 'janTablePen',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('janTablePen'),
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (!mode || event.button !== 0) return false
              const target = event.target as HTMLElement | null
              const cell = target?.closest?.('td, th') as HTMLElement | null
              if (!cell || !view.dom.contains(cell)) return false

              const pos = view.posAtDOM(cell, 0) - 1
              const node = view.state.doc.nodeAt(pos)
              if (!node || !/^table(Cell|Header)$/.test(node.type.name)) return false
              event.preventDefault()

              if (mode === 'copy') {
                if (!clipboard) {
                  clipboard = {}
                  for (const key of BORDER_KEYS) clipboard[key] = node.attrs[key]
                  clipboard.backgroundColor = node.attrs.backgroundColor
                  flash('본이 될 테두리를 집었다 — 이제 바를 칸을 누른다')
                  return true
                }
                view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...clipboard }))
                return true
              }

              const side = sideAt(cell, event.clientX, event.clientY)
              const value = mode === 'erase' ? 'none' : penToValue(currentPen())
              view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, [ATTR[side]]: value }))
              return true
            },
          },
          handleKeyDown: (_view, event) => {
            if (event.key === 'Escape' && mode) {
              setPenMode(null)
              clipboard = null
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})

/** 집어 둔 테두리를 버린다 (모드를 끄면 함께 버린다) */
export function clearBorderClipboard(): void {
  clipboard = null
}
