import { Image } from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * 그림 개체 — 워드의 「그림 서식」 탭에 있는 것들을 담는 노드.
 *
 * 예전에는 width 하나뿐이었다. 워드 사용자가 손에 익은 일(자르기·회전·
 * 텍스트 배치·테두리·효과·밝기)을 하려면 속성이 그만큼 있어야 한다.
 *
 * 저장은 HTML 문자열로 오가므로(getSavableHtml) 모든 속성은 img 의
 * data-* 로 나갔다가 그대로 돌아온다. 겉모습은 renderHTML 이 만드는
 * 인라인 스타일이 책임진다 — 표와 달리 그림은 노드 뷰를 쓰지 않아서
 * renderHTML 이 화면까지 그대로 닿는다.
 *
 * 자르기는 감싸는 span 이 필요하다(넘치는 부분을 잘라 내야 하므로).
 * 그래서 잘린 그림만 span.jan-img 로 감싸고, 안 자른 그림은 img 그대로 둔다 —
 * 붙여넣기·불러오기 때 들어오는 맨 img 도 그대로 읽힌다.
 */

/** 자르기 값: 위·오른쪽·아래·왼쪽을 % 로 (0~0.9) */
export interface Crop { t: number; r: number; b: number; l: number }

export function parseCrop(value: unknown): Crop | null {
  if (typeof value !== 'string' || !value) return null
  const parts = value.split(',').map((n) => Number(n))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [t, r, b, l] = parts.map((n) => Math.min(0.95, Math.max(0, n)))
  if (t + b >= 0.95 || l + r >= 0.95) return null
  return { t, r, b, l }
}

export function cropToString(crop: Crop): string {
  return [crop.t, crop.r, crop.b, crop.l].map((n) => Number(n.toFixed(4))).join(',')
}

/** 그림 보정 — 밝기·대비·채도·색조·흐림·흑백 (워드의 「수정」·「색」) */
export interface Adjust { bright: number; contrast: number; sat: number; hue: number; blur: number; gray: number; sepia: number }

export const ADJUST_DEFAULT: Adjust = { bright: 100, contrast: 100, sat: 100, hue: 0, blur: 0, gray: 0, sepia: 0 }

export function parseAdjust(value: unknown): Adjust {
  const out = { ...ADJUST_DEFAULT }
  if (typeof value !== 'string' || !value) return out
  for (const pair of value.split(';')) {
    const [k, v] = pair.split(':')
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (k === 'b') out.bright = n
    else if (k === 'c') out.contrast = n
    else if (k === 's') out.sat = n
    else if (k === 'h') out.hue = n
    else if (k === 'l') out.blur = n
    else if (k === 'g') out.gray = n
    else if (k === 'p') out.sepia = n
  }
  return out
}

export function adjustToString(a: Adjust): string {
  const map: [string, number, number][] = [
    ['b', a.bright, 100], ['c', a.contrast, 100], ['s', a.sat, 100],
    ['h', a.hue, 0], ['l', a.blur, 0], ['g', a.gray, 0], ['p', a.sepia, 0],
  ]
  const kept = map.filter(([, v, def]) => Math.round(v) !== def)
  return kept.map(([k, v]) => `${k}:${Math.round(v)}`).join(';')
}

/** CSS filter 문자열 (없으면 빈 문자열) */
export function adjustToFilter(a: Adjust): string {
  const bits: string[] = []
  if (Math.round(a.bright) !== 100) bits.push(`brightness(${a.bright}%)`)
  if (Math.round(a.contrast) !== 100) bits.push(`contrast(${a.contrast}%)`)
  if (Math.round(a.sat) !== 100) bits.push(`saturate(${a.sat}%)`)
  if (Math.round(a.hue) !== 0) bits.push(`hue-rotate(${a.hue}deg)`)
  if (a.blur > 0) bits.push(`blur(${a.blur}px)`)
  if (a.gray > 0) bits.push(`grayscale(${a.gray}%)`)
  if (a.sepia > 0) bits.push(`sepia(${a.sepia}%)`)
  return bits.join(' ')
}

/** 그림 스타일 갤러리 — 워드의 「그림 스타일」 */
export const IMAGE_STYLES: { key: string; label: string; hint: string }[] = [
  { key: 'none', label: '없음', hint: '꾸밈 없이' },
  { key: 'simple', label: '단순 테두리', hint: '가는 회색 테두리' },
  { key: 'thick', label: '두꺼운 테두리', hint: '굵은 검은 테두리' },
  { key: 'frame', label: '액자', hint: '흰 여백 + 테두리' },
  { key: 'shadow', label: '그림자', hint: '아래로 떨어지는 그림자' },
  { key: 'soft', label: '부드러운 그림자', hint: '넓게 퍼지는 그림자' },
  { key: 'round', label: '둥근 모서리', hint: '모서리를 둥글게' },
  { key: 'round-shadow', label: '둥근 모서리 + 그림자', hint: '카드처럼' },
  { key: 'circle', label: '원형', hint: '동그랗게 잘라 보여 준다' },
  { key: 'soft-edge', label: '부드러운 가장자리', hint: '가장자리를 흐리게' },
  { key: 'reflect', label: '반사', hint: '아래에 비친 그림' },
  { key: 'glow', label: '네온', hint: '테두리에 빛무리' },
  { key: 'polaroid', label: '폴라로이드', hint: '아래가 두꺼운 흰 액자' },
  { key: 'perspective', label: '원근 기울임', hint: '비스듬히 놓인 느낌' },
]

/** 텍스트 배치 — 워드의 「텍스트 줄 바꿈」 */
export const IMAGE_WRAPS: { key: string; label: string; hint: string }[] = [
  { key: 'topbottom', label: '위/아래', hint: '그림이 한 줄을 통째로 차지한다' },
  { key: 'inline', label: '글자처럼 취급', hint: '글자 사이에 끼워 넣는다' },
  { key: 'left', label: '왼쪽에 두고 감싸기', hint: '글이 오른쪽으로 흐른다' },
  { key: 'right', label: '오른쪽에 두고 감싸기', hint: '글이 왼쪽으로 흐른다' },
  { key: 'behind', label: '텍스트 뒤', hint: '글 뒤에 깔린다' },
  { key: 'front', label: '텍스트 앞', hint: '글 위에 얹힌다' },
]

/** 도형에 맞춰 자르기 (워드의 「도형에 맞춰 자르기」) */
export const IMAGE_SHAPES: { key: string; label: string; clip: string }[] = [
  { key: 'circle', label: '원', clip: 'circle(50%)' },
  { key: 'ellipse', label: '타원', clip: 'ellipse(50% 40%)' },
  { key: 'rounded', label: '둥근 사각형', clip: 'inset(0 round 12%)' },
  { key: 'triangle', label: '삼각형', clip: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
  { key: 'diamond', label: '마름모', clip: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  { key: 'pentagon', label: '오각형', clip: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
  { key: 'hexagon', label: '육각형', clip: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  { key: 'star', label: '별', clip: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
  { key: 'heart', label: '하트', clip: 'path("M 50 90 C 10 60 0 35 15 18 C 30 2 50 12 50 28 C 50 12 70 2 85 18 C 100 35 90 60 50 90 Z")' },
  { key: 'arrow', label: '화살표', clip: 'polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)' },
]

/** 지금 그림에 걸린 변형(회전·대칭)을 CSS transform 으로 */
function transformOf(attrs: Record<string, unknown>): string {
  const bits: string[] = []
  const rotate = Number(attrs.rotate) || 0
  if (rotate) bits.push(`rotate(${rotate}deg)`)
  const sx = attrs.flipH ? -1 : 1
  const sy = attrs.flipV ? -1 : 1
  if (sx < 0 || sy < 0) bits.push(`scale(${sx}, ${sy})`)
  if (attrs.style === 'perspective') bits.push('perspective(800px) rotateY(-14deg)')
  return bits.join(' ')
}

/** 자르기를 감싸는 span 과 안쪽 img 의 스타일로 푼다 */
function cropStyles(crop: Crop, boxWidth: string | null, nw: number, nh: number) {
  const kw = 1 - crop.l - crop.r
  const kh = 1 - crop.t - crop.b
  const inner = `width:${(100 / kw).toFixed(3)}%;margin-left:${(-crop.l / kw * 100).toFixed(3)}%;`
  // 세로는 그림 비율을 알아야 px 로 자를 수 있다. 모르면 가로만 자른다.
  let wrap = 'display:inline-block;overflow:hidden;vertical-align:bottom;'
  if (boxWidth) wrap += `width:${boxWidth};`
  let innerV = ''
  if (nw > 0 && nh > 0) {
    const ratio = nh / nw
    wrap += `aspect-ratio:${(kw / (kh * ratio)).toFixed(4)};`
    innerV = `margin-top:${(-crop.t / kh * (100 * ratio / kw)).toFixed(3)}%;height:auto;`
  }
  return { wrap, inner: inner + innerV }
}

const styleDecl: Record<string, string> = {
  none: '',
  simple: 'border:1px solid #b7bcc4;',
  thick: 'border:4px solid #2b2f36;',
  frame: 'border:1px solid #c9ced6;padding:8px;background:#fff;',
  shadow: 'box-shadow:0 6px 14px rgba(0,0,0,.28);',
  soft: 'box-shadow:0 14px 34px rgba(0,0,0,.22);',
  round: 'border-radius:14px;',
  'round-shadow': 'border-radius:14px;box-shadow:0 8px 20px rgba(0,0,0,.24);',
  circle: 'border-radius:50%;',
  'soft-edge': '-webkit-mask-image:radial-gradient(circle, #000 60%, transparent 100%);mask-image:radial-gradient(circle, #000 60%, transparent 100%);',
  reflect: '-webkit-box-reflect:below 4px linear-gradient(transparent, rgba(255,255,255,.28));',
  glow: 'box-shadow:0 0 18px 4px rgba(80,140,255,.55);',
  polaroid: 'border:1px solid #d7dae0;padding:10px 10px 30px;background:#fff;box-shadow:0 6px 16px rgba(0,0,0,.2);',
  perspective: 'box-shadow:0 10px 24px rgba(0,0,0,.25);',
}

/** img 자체에 걸리는 스타일 (테두리·효과·보정·회전) */
function imgStyle(attrs: Record<string, unknown>, inCrop: boolean): string {
  let css = ''
  const preset = typeof attrs.style === 'string' ? styleDecl[attrs.style] : ''
  if (preset) css += preset
  if (attrs.borderColor || attrs.borderWidth) {
    const w = attrs.borderWidth ? `${attrs.borderWidth}px` : '1px'
    const s = (attrs.borderStyle as string) || 'solid'
    css += `border:${w} ${s} ${(attrs.borderColor as string) || '#333'};`
  }
  if (attrs.radius) css += `border-radius:${attrs.radius}px;`
  if (attrs.shape) {
    const shape = IMAGE_SHAPES.find((s) => s.key === attrs.shape)
    if (shape) css += `clip-path:${shape.clip};`
  }
  const filter = adjustToFilter(parseAdjust(attrs.adjust))
  if (filter) css += `filter:${filter};`
  if (attrs.opacity != null && Number(attrs.opacity) < 100) css += `opacity:${Number(attrs.opacity) / 100};`
  const tf = transformOf(attrs)
  if (tf) css += `transform:${tf};`
  if (!inCrop && attrs.width) css += `width:${attrs.width};`
  if (!inCrop && attrs.height) css += `height:${attrs.height};`
  else if (!inCrop && attrs.width) css += 'height:auto;'
  return css
}

/** 텍스트 배치를 바깥 요소의 스타일로 */
function wrapStyle(attrs: Record<string, unknown>): string {
  const wrap = (attrs.wrap as string) || 'topbottom'
  const gap = 12
  if (wrap === 'left') return `float:left;margin:4px ${gap}px ${gap}px 0;`
  if (wrap === 'right') return `float:right;margin:4px 0 ${gap}px ${gap}px;`
  if (wrap === 'behind') return 'position:absolute;z-index:-1;pointer-events:none;'
  if (wrap === 'front') return 'position:absolute;z-index:5;'
  if (wrap === 'inline') return 'display:inline-block;vertical-align:middle;margin:0 2px;'
  return '' // topbottom — 기본 블록 흐름 (정렬은 data-align 이 CSS 로 처리)
}

export const ImageObject = Image.extend({
  name: 'image',
  draggable: true,

  addAttributes() {
    const attr = (name: string, dataName?: string) => ({
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(dataName || `data-${name}`),
      renderHTML: () => ({}), // 아래 renderHTML 이 한꺼번에 내보낸다
    })
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('width') || el.getAttribute('data-width'), renderHTML: () => ({}) },
      height: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('height') || el.getAttribute('data-height'), renderHTML: () => ({}) },
      align: attr('align'),
      wrap: attr('wrap'),
      rotate: { default: 0, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-rotate')) || 0, renderHTML: () => ({}) },
      flipH: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-flip-h') === '1', renderHTML: () => ({}) },
      flipV: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-flip-v') === '1', renderHTML: () => ({}) },
      crop: attr('crop'),
      shape: attr('shape'),
      style: attr('style', 'data-style'),
      borderColor: attr('borderColor', 'data-border-color'),
      borderWidth: attr('borderWidth', 'data-border-width'),
      borderStyle: attr('borderStyle', 'data-border-style'),
      radius: attr('radius'),
      adjust: attr('adjust'),
      opacity: attr('opacity'),
      nw: { default: null, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-nw')) || null, renderHTML: () => ({}) },
      nh: { default: null, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-nh')) || null, renderHTML: () => ({}) },
      lock: { default: true, parseHTML: (el: HTMLElement) => el.getAttribute('data-lock') !== '0', renderHTML: () => ({}) },
      /* 미세 이동 — 감싸기·글 앞뒤 배치에서 제자리를 조금씩 옮긴다 (한글의 0.2mm 이동) */
      dx: { default: 0, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-dx')) || 0, renderHTML: () => ({}) },
      dy: { default: 0, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-dy')) || 0, renderHTML: () => ({}) },
      /* 개체 보호 — 켜 두면 크기·위치가 바뀌지 않는다 (워드에 없는 한글 기능) */
      locked: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-locked') === '1', renderHTML: () => ({}) },
      /* 캡션 — 그림과 한 몸으로 움직인다 (한글의 캡션) */
      caption: attr('caption'),
      capPos: attr('capPos', 'data-cap-pos'),
    }
  },

  parseHTML() {
    return [
      // 캡션은 그림 속성(data-caption)에 들어 있다 — 글자로 다시 읽어들이면 안 된다
      { tag: 'span.jan-img-cap', ignore: true },
      { tag: 'span.jan-img img' },
      { tag: 'img[src]' },
    ]
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, unknown>
    const crop = parseCrop(a.crop)
    const data: Record<string, string> = {}
    const put = (key: string, value: unknown) => { if (value != null && value !== '' && value !== false) data[key] = String(value) }
    put('data-align', a.align)
    put('data-wrap', a.wrap)
    put('data-rotate', a.rotate || null)
    put('data-flip-h', a.flipH ? '1' : null)
    put('data-flip-v', a.flipV ? '1' : null)
    put('data-crop', a.crop)
    put('data-shape', a.shape)
    put('data-style', a.style)
    put('data-border-color', a.borderColor)
    put('data-border-width', a.borderWidth)
    put('data-border-style', a.borderStyle)
    put('data-radius', a.radius)
    put('data-adjust', a.adjust)
    put('data-opacity', a.opacity)
    put('data-nw', a.nw)
    put('data-nh', a.nh)
    put('data-lock', a.lock === false ? '0' : null)
    put('data-width', a.width)
    put('data-height', a.height)
    put('data-dx', a.dx || null)
    put('data-dy', a.dy || null)
    put('data-locked', a.locked ? '1' : null)
    put('data-caption', a.caption)
    put('data-cap-pos', a.capPos)

    const imgAttrs: Record<string, string> = {
      ...data,
      src: String(a.src ?? ''),
      class: 'jan-img-el',
    }
    if (a.alt) imgAttrs.alt = String(a.alt)
    if (a.title) imgAttrs.title = String(a.title)

    const caption = typeof a.caption === 'string' && a.caption !== '' ? a.caption : null
    const shift = a.dx || a.dy ? `transform:translate(${Number(a.dx) || 0}px, ${Number(a.dy) || 0}px);` : ''

    // 자르지도 캡션도 없으면 img 하나로 끝낸다 — 밖에서 들어온 맨 img 와 같은 모양
    if (!crop && !caption) {
      const css = imgStyle(a, false) + wrapStyle(a) + shift
      if (css) imgAttrs.style = css
      return ['img', imgAttrs]
    }

    let inner = ''
    let box = 'display:inline-block;vertical-align:bottom;'
    if (crop) {
      const cs = cropStyles(crop, (a.width as string) || null, Number(a.nw) || 0, Number(a.nh) || 0)
      inner = cs.inner
      box = cs.wrap
    } else if (a.width) {
      box += `width:${a.width};`
    }
    imgAttrs.style = inner + imgStyle(a, !!crop)

    const imgPart: unknown[] = crop
      ? ['span', { class: 'jan-img-clip', style: box }, ['img', imgAttrs]]
      : ['img', imgAttrs]
    if (!caption) {
      return ['span', { class: 'jan-img', style: box + wrapStyle(a) + shift, 'data-align': (a.align as string) || '' }, ['img', imgAttrs]] as never
    }

    const pos = (a.capPos as string) || 'bottom'
    const capEl = ['span', { class: 'jan-img-cap', 'data-cap-pos': pos }, caption]
    const kids = pos === 'top' || pos === 'left' ? [capEl, imgPart] : [imgPart, capEl]
    return [
      'span',
      {
        class: 'jan-img jan-img-figure',
        'data-align': (a.align as string) || '',
        'data-cap-pos': pos,
        style: `display:inline-flex;flex-direction:${pos === 'left' || pos === 'right' ? 'row' : 'column'};align-items:center;gap:4px;vertical-align:bottom;` + wrapStyle(a) + shift,
      },
      ...kids,
    ] as never
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey('janImageNatural'),
        view() {
          /* 원래 크기를 알아야 「원래 크기로」·세로 자르기가 된다 —
             그려진 뒤 한 번 읽어 노드에 적어 둔다. */
          const measure = () => {
            const root = editor.view.dom as HTMLElement
            root.querySelectorAll<HTMLImageElement>('img.jan-img-el:not([data-nw])').forEach((img) => {
              if (!img.naturalWidth) {
                img.addEventListener('load', () => measure(), { once: true })
                return
              }
              const pos = editor.view.posAtDOM(img, 0)
              if (pos == null || pos < 0) return
              const node = editor.state.doc.nodeAt(pos)
              if (!node || node.type.name !== 'image' || node.attrs.nw) return
              editor.view.dispatch(
                editor.view.state.tr
                  .setNodeMarkup(pos, undefined, { ...node.attrs, nw: img.naturalWidth, nh: img.naturalHeight })
                  .setMeta('addToHistory', false)
              )
            })
          }
          const timer = window.setTimeout(measure, 60)
          return {
            update: () => { window.setTimeout(measure, 0) },
            destroy: () => window.clearTimeout(timer),
          }
        },
      }),
    ]
  },
})
