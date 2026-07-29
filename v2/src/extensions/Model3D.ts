import { Node } from '@tiptap/core'
import { formatOf, parseModel } from '../lib/model3d'
import { createModelView } from '../lib/model3dView'
import type { ModelFormat } from '../lib/model3d'

/**
 * 3D 모델 개체 — 워드 「삽입 › 3D 모델」.
 *
 * 파일은 문서와 함께 담기고(janref: 또는 data:), 화면에서는 끌어서 돌려 본다.
 * 인쇄·다른 프로그램에서는 지금 보이는 각도 그대로의 그림이 필요하므로,
 * 돌릴 때마다 그 순간의 모습을 미리보기 그림으로 함께 저장한다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janModel3d: {
      insertModel3d: (attrs: { src: string; name?: string; format?: ModelFormat }) => ReturnType
      updateModel3d: (attrs: Record<string, unknown>) => ReturnType
    }
  }
}

export const Model3D = Node.create({
  name: 'janModel3d',
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
    const num = (name: string, def: number) => ({
      default: def,
      parseHTML: (el: HTMLElement) => Number(el.getAttribute(`data-${name}`) ?? def) || def,
      renderHTML: () => ({}),
    })
    return {
      src: str('src'),
      name: str('name'),
      format: str('format', 'glb'),
      poster: str('poster'),
      rotX: num('rot-x', 0),
      rotY: num('rot-y', 0.6),
      zoom: num('zoom', 1),
      width: num('w', 360),
      height: num('h', 260),
      align: str('align', 'center'),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-jan-model3d]' }]
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, unknown>
    const el = document.createElement('figure')
    el.setAttribute('data-jan-model3d', '1')
    for (const [k, v] of Object.entries({
      src: a.src, name: a.name, format: a.format, poster: a.poster,
      'rot-x': a.rotX, 'rot-y': a.rotY, zoom: a.zoom, w: a.width, h: a.height, align: a.align,
    })) if (v != null && v !== '') el.setAttribute(`data-${k}`, String(v))
    el.className = 'jan-model3d'
    el.style.cssText = `margin:10px 0;text-align:${String(a.align || 'center')};`
    /* 저장본에는 지금 각도의 그림을 넣는다 — 3D 를 못 그리는 곳에서도 보이게 */
    const img = document.createElement('img')
    img.src = String(a.poster || '')
    img.alt = String(a.name || '3D 모델')
    img.style.cssText = `width:${Number(a.width) || 360}px;height:${Number(a.height) || 260}px;object-fit:contain;`
    el.appendChild(img)
    return el
  },

  addCommands() {
    return {
      insertModel3d: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
      updateModel3d: (attrs) => ({ commands }) => commands.updateAttributes(this.name, attrs),
    }
  },

  /** 화면에서는 진짜 3D 로 보여 준다 (저장본은 그림, 화면은 살아 있는 모델) */
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('figure')
      dom.className = 'jan-model3d'
      dom.style.cssText = `margin:10px 0;text-align:${String(node.attrs.align || 'center')};`
      const canvas = document.createElement('canvas')
      const w = Number(node.attrs.width) || 360
      const h = Number(node.attrs.height) || 260
      canvas.width = w * 2
      canvas.height = h * 2
      canvas.style.cssText = `width:${w}px;height:${h}px;touch-action:none;cursor:grab;border-radius:6px;`
      canvas.tabIndex = 0
      canvas.setAttribute('aria-label', `3D 모델 ${String(node.attrs.name || '')} — 끌거나 화살표로 돌린다`)
      dom.appendChild(canvas)

      let viewer: ReturnType<typeof createModelView> | null = null
      let stop = false
      const load = async () => {
        try {
          const src = String(node.attrs.src || '')
          if (!src) return
          const res = await fetch(src)
          const buffer = await res.arrayBuffer()
          if (stop) return
          const mesh = parseModel(buffer, (String(node.attrs.format) as ModelFormat) || 'glb')
          viewer = createModelView(canvas, mesh, {
            rotX: Number(node.attrs.rotX) || 0,
            rotY: Number(node.attrs.rotY) || 0.6,
            zoom: Number(node.attrs.zoom) || 1,
          }, (state) => {
            // 돌린 각도와 그 모습의 그림을 문서에 담는다 (되돌리기에는 남기지 않는다)
            const pos = typeof getPos === 'function' ? getPos() : null
            if (pos == null) return
            const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs, rotX: state.rotX, rotY: state.rotY, zoom: state.zoom,
              poster: canvas.toDataURL('image/png'),
            })
            tr.setMeta('addToHistory', false)
            editor.view.dispatch(tr)
          })
        } catch (err) {
          dom.innerHTML = ''
          const note = document.createElement('div')
          note.className = 'jan-model3d-fail'
          note.textContent = `3D 모델을 열지 못했습니다 — ${(err as Error).message}`
          dom.appendChild(note)
        }
      }
      void load()

      return {
        dom,
        ignoreMutation: () => true,
        destroy() { stop = true; viewer?.destroy() },
      }
    }
  },
})

export { formatOf }
