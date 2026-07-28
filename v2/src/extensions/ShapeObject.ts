import { Node, mergeAttributes } from '@tiptap/core'
import { CLIPART, SHAPES, WORDART, shapeByKey } from '../lib/shapeLibrary'

/**
 * 그리기 개체 — 워드 「삽입 › 도형 · 텍스트 상자 · 아이콘 · WordArt」 를 한 노드로.
 * 한글의 「도형 · 글상자 · 그리기마당 · 글맵시」 와 같은 자리다.
 *
 * 그림(ImageObject)과 같은 배치 규칙(텍스트 배치·맞춤·미세 이동·개체 보호·캡션)을
 * 쓰기 때문에, 키보드 조작과 상황 메뉴도 그대로 이어 쓴다.
 *
 * 모양은 100×100 자리에 그린 SVG 조각(shapeLibrary)이라 어떤 크기로 늘려도
 * 뭉개지지 않는다. 글자는 SVG 가 아니라 HTML 로 얹어, 줄 바꿈·글꼴이
 * 본문과 똑같이 동작한다 (글맵시만 SVG 글자를 쓴다 — 길을 따라 흘러야 하므로).
 */

export type ShapeKind = 'shape' | 'textbox' | 'icon' | 'wordart'

const SVG_NS = 'http://www.w3.org/2000/svg'

function num(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 바깥 상자의 스타일 — 배치·크기·회전은 그림과 같은 규칙을 쓴다 */
function boxStyle(a: Record<string, unknown>): string {
  const w = num(a.width, 240)
  const h = num(a.height, 160)
  let css = `display:inline-block;position:relative;width:${w}px;height:${h}px;vertical-align:bottom;`
  const wrap = (a.wrap as string) || 'topbottom'
  if (wrap === 'left') css += 'float:left;margin:4px 12px 12px 0;'
  else if (wrap === 'right') css += 'float:right;margin:4px 0 12px 12px;'
  else if (wrap === 'behind') css += 'position:absolute;z-index:-1;pointer-events:none;'
  else if (wrap === 'front') css += 'position:absolute;z-index:5;'
  else if (wrap === 'inline') css += 'vertical-align:middle;margin:0 2px;'
  const bits: string[] = []
  if (a.dx || a.dy) bits.push(`translate(${num(a.dx, 0)}px, ${num(a.dy, 0)}px)`)
  if (num(a.rotate, 0)) bits.push(`rotate(${num(a.rotate, 0)}deg)`)
  if (a.flipH || a.flipV) bits.push(`scale(${a.flipH ? -1 : 1}, ${a.flipV ? -1 : 1})`)
  if (bits.length) css += `transform:${bits.join(' ')};`
  if (a.opacity != null && num(a.opacity, 100) < 100) css += `opacity:${num(a.opacity, 100) / 100};`
  if (a.shadow) css += 'filter:drop-shadow(0 6px 10px rgba(0,0,0,.3));'
  return css
}

/** 안쪽 글자 상자 — 도형이 정한 자리에 얹는다 */
function textStyle(a: Record<string, unknown>, def: { textBox?: [number, number, number, number] } | undefined): string {
  const area = def?.textBox || [6, 6, 88, 88]
  const vAlign = (a.vAlign as string) || 'middle'
  const justify = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center'
  let css =
    `position:absolute;left:${area[0]}%;top:${area[1]}%;width:${area[2]}%;height:${area[3]}%;` +
    `display:flex;align-items:${justify};justify-content:center;text-align:${(a.textAlign as string) || 'center'};` +
    'overflow:hidden;line-height:1.35;word-break:break-word;'
  css += `color:${(a.textColor as string) || '#1c1f26'};`
  css += `font-size:${num(a.fontSize, 15)}px;`
  if (a.fontFamily) css += `font-family:${a.fontFamily};`
  if (a.bold) css += 'font-weight:700;'
  if (a.italic) css += 'font-style:italic;'
  if (a.textDir === 'vertical') css += 'writing-mode:vertical-rl;text-orientation:upright;'
  else if (a.textDir === 'rotate90') css += 'writing-mode:vertical-rl;'
  else if (a.textDir === 'rotate270') css += 'writing-mode:vertical-rl;transform:rotate(180deg);'
  return css
}

export const ShapeObject = Node.create({
  name: 'janShape',
  group: 'block',
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    const str = (name: string, def: unknown = null) => ({
      default: def,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? def,
      renderHTML: () => ({}),
    })
    const bool = (name: string) => ({
      default: false,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) === '1',
      renderHTML: () => ({}),
    })
    const int = (name: string, def: number) => ({
      default: def,
      parseHTML: (el: HTMLElement) => num(el.getAttribute(`data-${name}`), def),
      renderHTML: () => ({}),
    })
    return {
      kind: str('kind', 'shape'),
      shape: str('shape', 'rect'),
      text: str('text', ''),
      /* 모양 */
      fill: str('fill', '#dbeafe'),
      stroke: str('stroke', '#2563eb'),
      strokeWidth: int('stroke-width', 2),
      strokeStyle: str('stroke-style', 'solid'),
      /* 글자 */
      textColor: str('text-color', '#1c1f26'),
      fontSize: int('font-size', 15),
      fontFamily: str('font-family'),
      bold: bool('bold'),
      italic: bool('italic'),
      textAlign: str('text-align', 'center'),
      vAlign: str('v-align', 'middle'),
      textDir: str('text-dir', 'horizontal'),
      /* 크기·자리 — 그림과 같은 이름을 쓴다 */
      width: int('w', 240),
      height: int('h', 160),
      rotate: int('rotate', 0),
      flipH: bool('flip-h'),
      flipV: bool('flip-v'),
      wrap: str('wrap'),
      align: str('align'),
      dx: int('dx', 0),
      dy: int('dy', 0),
      opacity: str('opacity'),
      shadow: bool('shadow'),
      locked: bool('locked'),
      caption: str('caption'),
      capPos: str('cap-pos', 'bottom'),
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-shape]' }, { tag: 'div[data-jan-shape]' }]
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, unknown>
    const kind = (a.kind as ShapeKind) || 'shape'
    const data: Record<string, string> = { 'data-jan-shape': '1' }
    const put = (k: string, v: unknown) => { if (v != null && v !== '' && v !== false) data[k] = String(v) }
    put('data-kind', kind)
    put('data-shape', a.shape)
    put('data-text', a.text)
    put('data-fill', a.fill)
    put('data-stroke', a.stroke)
    put('data-stroke-width', a.strokeWidth)
    put('data-stroke-style', a.strokeStyle)
    put('data-text-color', a.textColor)
    put('data-font-size', a.fontSize)
    put('data-font-family', a.fontFamily)
    put('data-bold', a.bold ? '1' : null)
    put('data-italic', a.italic ? '1' : null)
    put('data-text-align', a.textAlign)
    put('data-v-align', a.vAlign)
    put('data-text-dir', a.textDir)
    put('data-w', a.width)
    put('data-h', a.height)
    put('data-rotate', num(a.rotate, 0) || null)
    put('data-flip-h', a.flipH ? '1' : null)
    put('data-flip-v', a.flipV ? '1' : null)
    put('data-wrap', a.wrap)
    put('data-align', a.align)
    put('data-dx', num(a.dx, 0) || null)
    put('data-dy', num(a.dy, 0) || null)
    put('data-opacity', a.opacity)
    put('data-shadow', a.shadow ? '1' : null)
    put('data-locked', a.locked ? '1' : null)
    put('data-caption', a.caption)
    put('data-cap-pos', a.capPos)

    const kids: unknown[] = [drawing(a, kind)]
    const text = String(a.text || '')
    if (text && kind !== 'wordart') {
      const def = kind === 'shape' ? shapeByKey(String(a.shape)) : undefined
      kids.push(['span', { class: 'jan-shape-text', style: textStyle(a, def) }, text])
    }
    if (a.caption) {
      kids.push(['span', { class: 'jan-shape-cap', 'data-cap-pos': String(a.capPos || 'bottom') }, String(a.caption)])
    }

    return [
      'span',
      mergeAttributes(data, { class: `jan-shape jan-shape-${kind}`, style: boxStyle(a) }),
      ...kids,
    ] as never
  },
})

/** 도형·아이콘·글맵시를 그리는 SVG 조각 */
function drawing(a: Record<string, unknown>, kind: ShapeKind): unknown {
  const dash = a.strokeStyle === 'dashed' ? '8 6' : a.strokeStyle === 'dotted' ? '2 5' : undefined
  const sw = String(num(a.strokeWidth, 2))

  if (kind === 'wordart') {
    const preset = WORDART.find((w) => w.key === a.shape) || WORDART[0]
    const text = String(a.text || '글맵시')
    const id = `janwa-${preset.key}`
    const textAttrs: Record<string, string> = {
      fill: String(a.fill || '#2563eb'),
      'font-size': String(num(a.fontSize, 46)),
      'font-weight': a.bold === false ? '400' : '700',
      'font-family': String(a.fontFamily || 'inherit'),
    }
    if (a.stroke && num(a.strokeWidth, 0) > 0) {
      textAttrs.stroke = String(a.stroke)
      textAttrs['stroke-width'] = sw
      textAttrs['paint-order'] = 'stroke'
    }
    if (a.italic) textAttrs['font-style'] = 'italic'
    const body = preset.path
      ? [
          [`${SVG_NS} defs`, {}, [`${SVG_NS} path`, { id, d: preset.path, fill: 'none' }]],
          [`${SVG_NS} text`, textAttrs, [`${SVG_NS} textPath`, { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }, text]],
        ]
      : [[`${SVG_NS} text`, { ...textAttrs, x: '200', y: '72', 'text-anchor': 'middle' }, text]]
    return [`${SVG_NS} svg`, { class: 'jan-shape-svg', viewBox: '0 0 400 120', preserveAspectRatio: 'none' }, ...body]
  }

  if (kind === 'icon') {
    const icon = CLIPART.find((c) => c.key === a.shape) || CLIPART[0]
    return [`${SVG_NS} svg`, { class: 'jan-shape-svg', viewBox: '0 0 100 100' },
      [`${SVG_NS} path`, {
        d: icon.path, fill: 'none', stroke: String(a.stroke || '#2563eb'),
        'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }],
    ]
  }

  if (kind === 'textbox') {
    return [`${SVG_NS} svg`, { class: 'jan-shape-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
      [`${SVG_NS} rect`, {
        x: '1', y: '1', width: '98', height: '98',
        fill: String(a.fill || 'transparent'),
        stroke: String(a.stroke || '#94a3b8'),
        'stroke-width': sw,
        ...(dash ? { 'stroke-dasharray': dash } : {}),
        ...(a.radius ? { rx: String(a.radius) } : {}),
      }],
    ]
  }

  const def = shapeByKey(String(a.shape)) || SHAPES[0]
  const pathAttrs: Record<string, string> = {
    d: def.path,
    fill: def.lineOnly ? 'none' : String(a.fill || '#dbeafe'),
    stroke: String(a.stroke || '#2563eb'),
    'stroke-width': sw,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
    'vector-effect': 'non-scaling-stroke',
  }
  if (dash) pathAttrs['stroke-dasharray'] = dash
  if (def.arrow) pathAttrs['marker-end'] = 'url(#jan-arrow)'
  const kids: unknown[] = []
  if (def.arrow) {
    kids.push([`${SVG_NS} defs`, {},
      [`${SVG_NS} marker`, { id: 'jan-arrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' },
        [`${SVG_NS} path`, { d: 'M0 0 L10 5 L0 10 Z', fill: String(a.stroke || '#2563eb') }]],
    ])
    if (def.arrow === 'both') pathAttrs['marker-start'] = 'url(#jan-arrow)'
  }
  kids.push([`${SVG_NS} path`, pathAttrs])
  return [`${SVG_NS} svg`, { class: 'jan-shape-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none' }, ...kids]
}
