import { Image } from '@tiptap/extension-image'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { dropPoint } from '@tiptap/pm/transform'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import { peekBlobRef } from '../lib/blobRefs'

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
/** 아직 물리지 않은 그림 자리에 놓는 1×1 투명 그림 — 브라우저가 부를 것이 없다 */
const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

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

/* ── SVG 가 스스로 밝힌 치수 ──────────────────────────────────────────────
 *
 * 다른 갈래는 브라우저가 잰 naturalWidth·naturalHeight 가 곧 원래 크기다.
 * SVG 만 다르다 — width·height 없이 viewBox 만 있는 SVG 에는 물리 치수가 없어서,
 * 브라우저는 「기본 개체 크기」 300×150 안에 비율을 맞춰 넣은 값을 대신 준다.
 * 그림이 스스로 밝힌 치수와는 아무 상관이 없는 숫자다. 재어 보니(크로뮴 141):
 *
 *   viewBox="0 0 800 200"  → naturalWxH 300×75   → 화면 300×75
 *     (치수를 적어 둔 똑같은 그림은 800×200 → 화면 641×160. 두 배가 넘게 다르다)
 *   viewBox="0 0 200 800"  → 38×150              → 세로 그림이 폭 38px 조각이 된다
 *   viewBox="0 0 1 1000"   → 0×150               ← naturalWidth 가 0 이다
 *
 * 마지막 것이 특히 나쁘다. naturalWidth 가 0 이면 아래 janImageNatural 이
 * 「아직 안 물린 그림」 으로 보고 data-nw 를 영영 안 적는다. 그러면 예약 상자도
 * 못 걸고 브라우저의 비율만 남아, 그림 하나가 641×640,531px 로 부푼다 —
 * 재어 보니 문서 높이가 1,123 에서 640,684px 이 되었다(570배). 지면이 찢어진다.
 *
 * 워드와 한글은 viewBox 를 그림의 치수로 읽는다. 우리도 그렇게 읽는다.
 * 알맹이를 읽지 못하면(멀리 있는 .svg 주소 따위) 손대지 않고 예전 길로 둔다 —
 * 못 읽은 채로 지어낸 숫자보다 브라우저가 준 값이 적어도 화면과는 맞기 때문이다.
 */

/** CSS 길이 단위를 px 로 (백분율·상대 단위는 물리 치수가 아니므로 뺀다) */
const CSS_UNIT_PX: Record<string, number> = {
  '': 1, px: 1, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6,
}

function cssLengthToPx(value: string | undefined): number | null {
  if (!value) return null
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(value)
  if (!m) return null
  const n = Number(m[1])
  const k = CSS_UNIT_PX[m[2].toLowerCase()]
  return Number.isFinite(n) && n > 0 && k !== undefined ? n * k : null
}

export interface NaturalSize { nw: number; nh: number }

/** 예약 상자에 쓸 만한 수인지 — 0 이나 어처구니없이 큰 값은 안 쓴다 */
function sane(nw: number, nh: number): NaturalSize | null {
  const w = Math.round(nw)
  const h = Math.round(nh)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  if (w < 1 || h < 1 || w > 50000 || h > 50000) return null
  return { nw: w, nh: h }
}

const SVG_OPEN_TAG = /<svg\b[^>]*>/i
const NUMBERS = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

/** SVG 글자에서 여는 태그 하나만 보고 치수를 낸다 (안쪽 symbol 의 viewBox 에 속지 않게) */
export function svgSizeFromMarkup(markup: string): NaturalSize | null {
  const open = SVG_OPEN_TAG.exec(markup)
  if (!open) return null
  const tag = open[0]
  const pick = (name: string) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
    return m ? (m[1] ?? m[2]) : undefined
  }
  const w = cssLengthToPx(pick('width'))
  const h = cssLengthToPx(pick('height'))
  if (w && h) return sane(w, h)

  const vb = pick('viewBox')
  const nums = vb ? (vb.match(NUMBERS) || []).map(Number) : []
  if (nums.length === 4 && nums[2] > 0 && nums[3] > 0) {
    /* 한쪽만 물리 치수로 적혀 있으면 viewBox 의 비율로 나머지를 채운다 */
    const ratio = nums[2] / nums[3]
    if (w) return sane(w, w / ratio)
    if (h) return sane(h * ratio, h)
    return sane(nums[2], nums[3])
  }
  return null
}

/** 한 번 읽은 것은 기억한다 — renderHTML 은 다시 그릴 때마다 부르는 자리다 */
const svgSizes = new Map<string, NaturalSize | null>()

function remember(key: string, size: NaturalSize | null): NaturalSize | null {
  if (svgSizes.size > 200) svgSizes.clear()
  svgSizes.set(key, size)
  return size
}

/** data: 주소에 담긴 SVG 글자를 앞에서 조금만 꺼낸다 — viewBox 는 여는 태그에 있다 */
function svgHeadFromDataUrl(src: string): string | null {
  const comma = src.indexOf(',')
  if (comma < 0) return null
  const base64 = /;base64/i.test(src.slice(0, comma))
  let body = src.slice(comma + 1)
  const HEAD = 8192
  try {
    if (base64) {
      if (body.length > HEAD) body = body.slice(0, HEAD - (HEAD % 4))
      return atob(body)
    }
    if (body.length > HEAD) body = body.slice(0, HEAD)
    /* 퍼센트 인코딩은 %XX 가 잘리면 터진다 — 잘린 꼬리를 한두 자 떼어 본다 */
    for (let i = 0; i < 3; i += 1) {
      try { return decodeURIComponent(body) } catch { body = body.slice(0, -1) }
    }
    return null
  } catch { return null }
}

/**
 * 이 주소의 그림이 SVG 라면 스스로 밝힌 치수를 돌려준다 (아니거나 못 읽으면 null).
 *
 * 알맹이가 지금 손에 있는 것만 읽는다 — data: 주소와, 이미 물려 둔 저장소 주소.
 * 멀리 있는 .svg 주소는 여기서 알 수 없다(가져오려면 기다려야 하는데 조판은 기다리지
 * 않는다). 그때는 null 을 주고 예전 길로 둔다.
 */
export function svgIntrinsicSize(src: unknown): NaturalSize | null {
  if (typeof src !== 'string' || !src) return null
  if (src.startsWith('jan-blob://')) {
    const cached = peekBlobRef(src)
    /* 아직 안 풀린 주소는 기억하지 않는다 — 곧 풀리면 그때 읽어야 한다 */
    return cached ? svgIntrinsicSize(cached) : null
  }
  /* SVG 가 아닌 것은 기억할 것도 없다 — 큰 그림의 data: 주소를 열쇠로 붙들지 않는다 */
  if (!/^data:image\/svg\+xml/i.test(src)) return null
  if (svgSizes.has(src)) return svgSizes.get(src) ?? null
  const head = svgHeadFromDataUrl(src)
  return remember(src, head ? svgSizeFromMarkup(head) : null)
}

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

/**
 * 자르기를 두 겹의 스타일로 푼다 — 보이는 만큼의 상자와, 그 안에 넘치게 놓인 그림.
 *
 * 워드는 자르면 상자 자체가 줄어든다. 그래서 상자는 남는 몫(kw·kh)만큼만 잡고,
 * 그림은 상자보다 1/kw·1/kh 배 크게 놓아 잘라 낸 부분이 상자 밖으로 나가게 한다.
 *
 * 예전에는 그림을 흐름 안에 두고 margin 으로 밀었는데 두 군데가 어긋나 있었다.
 *  하나. 위로 미는 몫에 1/kh 가 한 번 더 곱해져 있었다. 위아래를 4분의 1씩 자르면
 *        60px 만 올려야 하는데 120px 을 올려 엉뚱한 띠가 보였고, 많이 자르면 그림이
 *        상자 위로 통째로 빠져나가 흰 자리만 남았다.
 *  둘.  넘치게 놓아야 할 그림에 max-width:100% 가 걸려 가로로는 아예 넘치지 못했다
 *        (그 빗장을 푸는 규칙은 span.jan-img-clip 안쪽에만 있었는데, 캡션 없는 그림은
 *        그 span 을 쓰지 않고 있었다). 그러면 상자만 비율대로 길어지고 그림은 그대로라
 *        320×240 그림을 좌우 30% 자를 때 상자가 320×600 이 되어 아래에 360px 흰 공백이
 *        남았다 — 「자르면 아래에 흰 자리가 생긴다」 가 이것이다.
 *
 * 이제 그림을 상자 안에 절대 자리로 놓는다. 왼쪽·위로 미는 몫은 상자의 너비·높이에
 * 견준 백분율이라, 상자가 늘거나 줄어도(본문 너비에 맞춤·손잡이 끌기) 저절로 따라온다.
 */
function cropStyles(crop: Crop, boxWidth: string | null, boxHeight: string | null, nw: number, nh: number) {
  const kw = 1 - crop.l - crop.r
  const kh = 1 - crop.t - crop.b
  let wrap = 'display:inline-block;overflow:hidden;vertical-align:bottom;max-width:100%;'
  /* 원본 크기를 아직 모르면 세로로는 자를 수 없다 — 높이는 그림이 정하게 두고 가로만 자른다.
     (그림이 물리면 janImageNatural 이 nw·nh 를 적어 주고 여기로 다시 온다) */
  if (!(nw > 0 && nh > 0)) {
    if (boxWidth) wrap += `width:${boxWidth};`
    const inner = 'display:block;max-width:none;height:auto;'
      + `width:${(100 / kw).toFixed(3)}%;margin-left:${(-crop.l / kw * 100).toFixed(3)}%;`
    return { wrap, inner }
  }
  wrap += 'position:relative;'
  /* 너비를 손으로 정하지 않았으면 원본에서 남는 몫이 곧 상자 너비다 — 자를수록 줄어든다 */
  wrap += `width:${boxWidth || `${Math.round(nw * kw)}px`};`
  /* 높이까지 손으로 정했으면(비율 고정을 푼 경우) 그대로 쓰고, 아니면 비율이 정한다 */
  if (boxHeight) wrap += `height:${boxHeight};`
  else wrap += `aspect-ratio:${(nw * kw).toFixed(3)}/${(nh * kh).toFixed(3)};`
  const inner = 'position:absolute;max-width:none;'
    + `left:${(-crop.l / kw * 100).toFixed(3)}%;top:${(-crop.t / kh * 100).toFixed(3)}%;`
    + `width:${(100 / kw).toFixed(3)}%;height:${(100 / kh).toFixed(3)}%;`
  return { wrap, inner }
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

/**
 * 잘라 낸 뒤에도 보이는 상자에 걸려야 하는 꾸밈 — 테두리·그림자·둥근 모서리·도형·회전.
 *
 * 자를 때는 이것들이 바깥 상자로 나간다. 안쪽 그림에 붙이면 테두리가 잘려 나간 자리에
 * 그려져 아예 보이지 않고, 회전은 상자보다 훨씬 큰 그림을 제 가운데로 돌려 엉뚱한 데를
 * 비춘다. 워드는 자른 결과에 테두리를 두르고 자른 결과를 돌린다.
 */
function decorStyle(attrs: Record<string, unknown>): string {
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
  const tf = transformOf(attrs)
  if (tf) css += `transform:${tf};`
  return css
}

/** 그림 알맹이에만 걸리는 것 — 색 보정과 투명도 (자르든 안 자르든 그림에 붙는다) */
function pixelStyle(attrs: Record<string, unknown>): string {
  let css = ''
  const filter = adjustToFilter(parseAdjust(attrs.adjust))
  if (filter) css += `filter:${filter};`
  if (attrs.opacity != null && Number(attrs.opacity) < 100) css += `opacity:${Number(attrs.opacity) / 100};`
  return css
}

/** img 자체에 걸리는 스타일 — 자를 때는 꾸밈이 바깥으로 나가고 알맹이 효과만 남는다 */
function imgStyle(attrs: Record<string, unknown>, inCrop: boolean): string {
  if (inCrop) return pixelStyle(attrs)
  let css = decorStyle(attrs) + pixelStyle(attrs)
  if (attrs.width) css += `width:${attrs.width};`
  if (attrs.height) css += `height:${attrs.height};`
  else if (attrs.width) css += 'height:auto;'
  return css
}

/**
 * 감싸기 모양 — 글이 그림의 「굽은 가장자리」를 따라 흐르게 하는 값.
 *
 * 워드의 「자세히 편집 › 배치 다듬기」, 한글의 「바깥 여백 다각형」 에 해당한다.
 * 밖에서 붙여넣은 마크업은 이것을 style 에 담아 온다 — 예전에는 renderHTML 이
 * 스타일을 통째로 새로 짜는 바람에 float 도 shape-outside 도 함께 버려졌다.
 * 그러면 원형 그림을 넣어도 글은 네모난 상자를 피해 흐른다.
 *
 * 값을 함부로 받으면 style 주입이 되므로, 아는 함수 꼴만 통과시킨다.
 */
const SHAPE_OUTSIDE_OK = /^(none|circle\([^;{}<>]*\)|ellipse\([^;{}<>]*\)|inset\([^;{}<>]*\)|polygon\([^;{}<>]*\))$/i

export function safeShapeOutside(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v || v.length > 400) return null
  return SHAPE_OUTSIDE_OK.test(v) ? v : null
}

/** 인라인 style 문자열에서 한 속성 값을 꺼낸다 (밖에서 붙여넣은 마크업을 읽을 때) */
function fromInlineStyle(el: HTMLElement, prop: string): string | null {
  const v = el.style.getPropertyValue(prop)
  return v ? v.trim() : null
}

/** 텍스트 배치를 바깥 요소의 스타일로 */
function wrapStyle(attrs: Record<string, unknown>): string {
  const wrap = (attrs.wrap as string) || 'topbottom'
  const gap = 12
  /* 감싸기일 때만 뜻이 있다 — shape-outside 는 뜬 상자(float)에만 걸린다 */
  const shape = safeShapeOutside(attrs.shapeOutside)
  const shapeCss = shape
    ? `shape-outside:${shape};${attrs.shapeMargin ? `shape-margin:${Number(attrs.shapeMargin) || 0}px;` : ''}`
    : ''
  if (wrap === 'left') return `float:left;margin:4px ${gap}px ${gap}px 0;${shapeCss}`
  if (wrap === 'right') return `float:right;margin:4px 0 ${gap}px ${gap}px;${shapeCss}`
  if (wrap === 'behind') return 'position:absolute;z-index:-1;pointer-events:none;'
  if (wrap === 'front') return 'position:absolute;z-index:5;'
  if (wrap === 'inline') return 'display:inline-block;vertical-align:middle;margin:0 2px;'
  return '' // topbottom — 기본 블록 흐름 (정렬은 data-align 이 CSS 로 처리)
}

/** 끌기 시작한 그림의 자리 — 문서가 바뀌면 함께 옮겨 간다 */
const dragFromKey = new PluginKey<number | null>('janImageDragFrom')

/** 못 물린 그림들의 주소 — 화면에 「표시할 수 없습니다」 자리를 남기는 표시를 붙이는 데 쓴다 */
const brokenKey = new PluginKey<BrokenState>('janImageBroken')

interface BrokenState { srcs: Set<string>; decos: DecorationSet }

/** 지금 이 그림을 「못 물렸다」 로 볼 것인가 — 주소가 없거나, 불러오다 튕겼거나 */
function isBrokenSrc(src: unknown, broken: Set<string>): boolean {
  if (typeof src !== 'string' || src === '') return true
  return broken.has(src)
}

/** 못 물린 그림마다 data-jan-broken 을 얹는다 (글 속으로는 파고들지 않는다 — 그림은 블록이다) */
function brokenDecos(doc: import('@tiptap/pm/model').Node, broken: Set<string>): DecorationSet {
  const found: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'image') {
      if (isBrokenSrc(node.attrs.src, broken)) {
        found.push(Decoration.node(pos, pos + node.nodeSize, { 'data-jan-broken': '1' }))
      }
      return false
    }
    return node.isBlock
  })
  return found.length ? DecorationSet.create(doc, found) : DecorationSet.empty
}

/**
 * 놓은 자리의 문서 위치 — 그 자리가 문서 밖이면 가장 가까운 붙일 자리를 찾는다.
 *
 * `posAtCoords` 는 글이 없는 자리(쪽 사이 빈틈, 쪽 옆 그림자 자리, 편집기 바깥 여백)에서
 * null 을 준다. 예전에는 그때 그냥 빠져나왔는데, 그러면 preventDefault 를 안 하므로
 * 브라우저와 ProseMirror 의 기본 놓기가 그대로 돌아 그림이 둘이 되는 길이 열렸다.
 * 워드는 아무 데나 놓아도 가장 가까운 자리에 넣는다 — 그 흉내를 낸다.
 */
function posOrNearest(view: EditorView, x: number, y: number): number | null {
  const 재기 = (px: number, py: number) => {
    try { return view.posAtCoords({ left: px, top: py }) } catch { return null }
  }
  const 곧바로 = 재기(x, y)
  if (곧바로) return 곧바로.pos

  const rect = view.dom.getBoundingClientRect()
  const cx = Math.min(Math.max(x, rect.left + 4), rect.right - 4)
  const cy = Math.min(Math.max(y, rect.top + 4), rect.bottom - 4)
  /* 가로로 먼저 끌어들이고(쪽 옆 그림자 자리), 세로로 조금씩 위아래를 더듬는다
     (쪽 사이 빈틈은 위쪽이 앞 쪽의 끝, 아래쪽이 다음 쪽의 처음이다) */
  for (const dy of [0, -8, 8, -20, 20, -44, 44, -80, 80]) {
    const py = Math.min(Math.max(cy + dy, rect.top + 4), rect.bottom - 4)
    const hit = 재기(cx, py)
    if (hit) return hit.pos
  }
  return null
}

/** 화면의 img 요소가 문서의 어느 자리인지 (그림 노드가 아니면 null) */
function imagePosFromDom(view: EditorView, target: EventTarget | null): number | null {
  const el = target as HTMLElement | null
  if (!el || el.nodeType !== 1 || el.tagName !== 'IMG') return null
  let raw: number
  try { raw = view.posAtDOM(el, 0) } catch { return null }
  for (const p of [raw, raw - 1, raw + 1]) {
    if (p < 0) continue
    const node = view.state.doc.nodeAt(p)
    if (node && node.type.name === 'image') return p
  }
  return null
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
      /* 화면에는 빈 그림을 놓고 주소는 data-blob-ref 에 두므로, 읽을 때 그것을 먼저 본다 */
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-blob-ref') || el.getAttribute('src'),
        renderHTML: () => ({}),
      },
      width: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('width') || el.getAttribute('data-width'), renderHTML: () => ({}) },
      height: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('height') || el.getAttribute('data-height'), renderHTML: () => ({}) },
      align: attr('align'),
      /* 밖에서 붙여넣은 그림은 배치를 style 의 float 에 담아 온다 —
         data-wrap 이 없다고 「위/아래」 로 보면 감싸기가 통째로 풀린다 */
      wrap: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const own = el.getAttribute('data-wrap')
          if (own) return own
          const f = fromInlineStyle(el, 'float')
          return f === 'left' || f === 'right' ? f : null
        },
        renderHTML: () => ({}),
      },
      shapeOutside: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          safeShapeOutside(el.getAttribute('data-shape-outside') ?? fromInlineStyle(el, 'shape-outside')),
        renderHTML: () => ({}),
      },
      shapeMargin: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-shape-margin') ?? fromInlineStyle(el, 'shape-margin')
          const n = parseFloat(String(raw ?? ''))
          return Number.isFinite(n) && n >= 0 && n <= 200 ? n : null
        },
        renderHTML: () => ({}),
      },
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
      /* 움직이는 그림(GIF·APNG)을 멈춰 둘까 — 문서를 읽는 동안 옆에서 계속 도는 그림은
         눈을 끌어 글을 못 읽게 한다. 그렇다고 늘 멈춰 두면 움직임으로 설명하는 그림
         (파면이 퍼져 쐐기가 서는 그림 같은 것)은 뜻을 잃는다. 그래서 사람이 고른다. */
      still: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-still') === '1', renderHTML: () => ({}) },
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
    /* SVG 는 브라우저가 잰 값 대신 그림이 스스로 밝힌 치수를 쓴다 (위 svgIntrinsicSize 참고).
       여기서 다시 읽는 까닭은, 예전 판이 적어 둔 data-nw(브라우저의 기본 개체 크기
       300×150 에 맞춰 넣은 값)가 이미 문서에 저장되어 있어서다 — 다시 그리면 스스로 고쳐진다. */
    const svgSize = svgIntrinsicSize(a.src)
    const data: Record<string, string> = {}
    const put = (key: string, value: unknown) => { if (value != null && value !== '' && value !== false) data[key] = String(value) }
    put('data-align', a.align)
    put('data-wrap', a.wrap)
    put('data-shape-outside', safeShapeOutside(a.shapeOutside))
    put('data-shape-margin', a.shapeMargin)
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
    /* 이미 적혀 있는 값이 SVG 의 것과 어긋나면 여기서 바로잡아 내보낸다 — 예전 판이 적어 둔
       브라우저 기본 치수는 이렇게 저장 한 번으로 씻긴다. 아직 아무 값도 없으면 비워 둔다:
       아래 janImageNatural 이 노드에 적어야 「원래 크기로」 같은 것이 함께 맞는다
       (data-nw 를 미리 내보내면 그쪽 선별자 :not([data-nw]) 에 걸려 영영 안 적힌다). */
    put('data-nw', a.nw ? (svgSize ? svgSize.nw : a.nw) : null)
    put('data-nh', a.nh ? (svgSize ? svgSize.nh : a.nh) : null)
    put('data-lock', a.lock === false ? '0' : null)
    put('data-width', a.width)
    put('data-height', a.height)
    put('data-dx', a.dx || null)
    put('data-dy', a.dy || null)
    put('data-locked', a.locked ? '1' : null)
    put('data-caption', a.caption)
    put('data-cap-pos', a.capPos)
    put('data-still', a.still ? '1' : null)

    /* 저장소 주소(jan-blob://)는 브라우저가 읽지 못한다. 그대로 src 에 넣으면 화면에 붙는
       순간마다 부르고 실패한다 — 다시 그릴 때마다 되풀이되어 콘솔에 만 건이 쌓였다.
       그래서 src 에는 빈 그림을 놓고 주소는 data-blob-ref 에 둔다.
       진짜 그림은 blobRefs 가 찾아 물려 준다. 저장할 때는 이 글자열 안의 jan-blob:// 를
       그대로 읽으므로(resolveBlobRefsInHtml) 저장 경로는 달라지지 않는다. */
    const rawSrc = String(a.src ?? '')
    const isStoreRef = rawSrc.startsWith('jan-blob://')
    const imgAttrs: Record<string, string> = {
      ...data,
      src: isStoreRef ? BLANK_PIXEL : rawSrc,
      class: 'jan-img-el',
    }
    if (isStoreRef) imgAttrs['data-blob-ref'] = rawSrc
    if (a.alt) imgAttrs.alt = String(a.alt)
    if (a.title) imgAttrs.title = String(a.title)

    /* 알맹이가 오기 전에 자리를 잡아 둔다.
       빈 그림은 1×1 이라 그대로 두면 높이가 거의 0으로 잡힌다. 그 상태로 조판이 한 번
       끝나고, 잠시 뒤 진짜 그림이 물리면 높이가 수백 px 로 뛰어 쪽이 통째로 밀린다.
       원래 크기를 알고 있으니(data-nw·nh) 비율을 미리 일러 준다 — 그림이 와도 자리가
       그대로라 다시 조판할 일이 없다. */
    const nw = svgSize ? svgSize.nw : Number(a.nw) || 0
    const nh = svgSize ? svgSize.nh : Number(a.nh) || 0
    /* 비율만 일러 주면 모자란다 — 빈 그림은 1×1 이라 폭이 1px 로 잡히고, 비율을 지켜 봐야
       높이도 1px 이다. 원래 폭까지 함께 일러 줘야 진짜 그림이 왔을 때와 같은 자리가 된다
       (본문보다 넓은 그림은 본문 폭에 맞춘다 — 물린 뒤와 똑같이). 뒤에 오는 imgStyle 이
       사람이 정한 크기를 덮어쓰므로, 손으로 크기를 준 그림은 그 값이 이긴다.
       예전에는 저장소 주소(jan-blob://)일 때만 걸렸다. 그런데 밖에서 온 http(s) 그림의
       주소가 깨지면 브라우저가 알맹이를 0×0 으로 잡아 상자가 통째로 쪼그라든다 —
       원래 크기를 알고 있다면(data-nw·nh) 주소가 무엇이든 그 자리를 지켜야 한다. */
    const reserve = !crop && nw > 0 && nh > 0
      ? `width:min(100%,${nw}px);aspect-ratio:${nw}/${nh};`
      : ''

    const caption = typeof a.caption === 'string' && a.caption !== '' ? a.caption : null
    const shift = a.dx || a.dy ? `transform:translate(${Number(a.dx) || 0}px, ${Number(a.dy) || 0}px);` : ''

    // 자르지도 캡션도 없으면 img 하나로 끝낸다 — 밖에서 들어온 맨 img 와 같은 모양
    if (!crop && !caption) {
      const css = reserve + imgStyle(a, false) + wrapStyle(a) + shift
      if (css) imgAttrs.style = css
      return ['img', imgAttrs]
    }

    let inner = ''
    let box = 'display:inline-block;vertical-align:bottom;'
    if (crop) {
      const cs = cropStyles(crop, (a.width as string) || null, (a.height as string) || null, nw, nh)
      inner = cs.inner
      box = cs.wrap
    } else if (a.width) {
      box += `width:${a.width};`
    }
    imgAttrs.style = reserve + inner + imgStyle(a, !!crop)

    /* 자른 그림은 두 겹이다. 안쪽 span.jan-img-clip 이 넘치는 부분을 잘라 내고,
       그 바깥 span 이 꾸밈(테두리·액자 여백·그림자·회전·도형)을 쓴다. 꾸밈을 잘라 내는
       span 에 함께 두면 액자의 흰 여백이 그림에 덮여 사라진다 — 잘린 그림 안에서는
       그림이 절대 자리로 놓여 안쪽 여백까지 차지하기 때문이다. */
    const imgPart: unknown[] = crop
      ? ['span', { class: 'jan-img-deco', style: `display:inline-block;vertical-align:bottom;max-width:100%;${decorStyle(a)}` },
          ['span', { class: 'jan-img-clip', style: box }, ['img', imgAttrs]]]
      : ['img', imgAttrs]
    if (!caption) {
      const outer = crop ? 'display:inline-block;vertical-align:bottom;max-width:100%;' : box
      return ['span', { class: 'jan-img', style: outer + wrapStyle(a) + shift, 'data-align': (a.align as string) || '' }, imgPart] as never
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
        key: dragFromKey,
        /* 끌기 시작한 그림이 지금 어디 있는지 — 문서가 바뀌어도 따라 옮긴다.
           고름(selection)에 기대면 안 된다: 그림을 곧바로 끌면 개체 고름이 아닐 수 있고,
           끄는 사이 노드가 다시 그려지면서 글자 고름으로 떨어지기도 한다. */
        state: {
          init: () => null as number | null,
          apply(tr, value) {
            const set = tr.getMeta(dragFromKey) as number | null | undefined
            if (set !== undefined) return set
            return value == null ? null : tr.mapping.map(value)
          },
        },
        /**
         * 놓는 순간을 가로채기 단계(capture)에서 잡는다.
         *
         * 편집기 안에서 drop 을 듣는 플러그인이 여럿이고(재어 보니 아홉), 우리 것은 그 가운데
         * 일흔두 번째다. 앞선 것이 먼저 처리하면 우리 차례는 오지 않는다 — 그래서 「우리가
         * 직접 옮긴다」 는 고침이 걸리지 않고 브라우저 기본 동작이 그대로 일어났다.
         * 가로채기 단계는 거품이 올라오기 전이라 차례를 다툴 일이 없다.
         */
        view(editorView) {
          const onDrop = (event: Event) => {
            const view = editorView
            const from = dragFromKey.getState(view.state)
            if (from == null) return
            const node = view.state.doc.nodeAt(from)
            if (!node || node.type.name !== 'image') return
            const drag = event as DragEvent

            /* 여기부터는 우리가 끌던 그림이 확실하다 — 무슨 일이 있어도 브라우저와 ProseMirror 의
               기본 놓기가 돌게 두면 안 된다. 그 기본 길은 집어 든 자리를 기억했다가 놓을 때 거기를
               지우는데, 끄는 사이 쪽이 다시 짜여 그림이 옮겨지면 못 지우고 넣기만 해 둘이 된다. */
            const 끝내기 = () => {
              event.preventDefault()
              event.stopPropagation()
              if ('stopImmediatePropagation' in event) event.stopImmediatePropagation()
              /* ProseMirror 의 drop 처리기가 하던 뒷정리를 대신한다.
                 우리가 전파를 끊으므로 그쪽 finally 가 돌지 않고, 놓은 그림은 새 요소로 다시
                 그려져 원래 요소가 문서에서 떨어져 나간다 — 브라우저가 그 떨어진 요소에 보내는
                 dragend 는 편집기까지 올라오지 못해 view.dragging 이 영영 남는다.
                 그러면 조판 엔진이 「끌고 있는 중」 으로 보고 쪽 나눔을 통째로 멈춘다. */
              ;(view as unknown as { dragging?: unknown }).dragging = null
            }

            const at = posOrNearest(view, drag.clientX, drag.clientY)
            const slice = new Slice(Fragment.from(node), 0, 0)
            /* 붙일 자리를 못 찾으면 옮기지 않고 제자리에 둔다 — 그래도 기본 놓기는 막는다 */
            const target = at == null ? null : dropPoint(view.state.doc, at, slice)
            if (target == null) { 끝내기(); return }

            /* Ctrl(윈도) · Alt(맥) 을 누른 채 놓으면 워드처럼 복사다 — 그때만 원본을 남긴다 */
            const copy = drag.ctrlKey || drag.altKey
            const tr = view.state.tr
            if (!copy) tr.delete(from, from + node.nodeSize)
            const where = tr.mapping.map(target)
            tr.insert(where, node)
            const landed = tr.doc.nodeAt(where)
            /* 옮긴 뒤에도 고른 채로 둔다 — 워드처럼 바로 이어서 다룰 수 있게 */
            if (landed && landed.type.name === 'image') tr.setSelection(NodeSelection.create(tr.doc, where))
            tr.setMeta(dragFromKey, null)
            view.dispatch(tr)
            끝내기()
          }
          editorView.dom.addEventListener('drop', onDrop, true)
          return {
            destroy() { editorView.dom.removeEventListener('drop', onDrop, true) },
          }
        },
        props: {
          handleDOMEvents: {
            dragstart(view, event) {
              const pos = imagePosFromDom(view, (event as DragEvent).target)
              view.dispatch(view.state.tr.setMeta(dragFromKey, pos).setMeta('addToHistory', false))
              return false
            },
            dragend(view) {
              if (dragFromKey.getState(view.state) != null) {
                view.dispatch(view.state.tr.setMeta(dragFromKey, null).setMeta('addToHistory', false))
              }
              return false
            },
          },

          /**
           * 그림을 끌어 옮기는 일은 우리가 직접 한다 — 지우기와 넣기를 한 트랜잭션에.
           *
           * 브라우저의 끌어놓기에 맡기면, 집어 든 자리를 기억했다가 놓을 때 거기를 지운다.
           * 그런데 끄는 사이 쪽이 다시 짜여 그림이 다른 자리로 가면 원래 자리를 못 찾아
           * 지우지 못하고 넣기만 한다 — 그림이 둘이 된다. 여백에 닿을 때 · 표 선에 닿을 때 ·
           * 쪽을 넘길 때가 모두 쪽이 다시 짜이는 순간이라 꼭 그때 벌어졌다.
           *
           * 우리는 끌기 시작한 자리를 위 state 가 문서 변화를 따라 옮겨 주므로, 놓는 순간
           * 그 그림이 어디 있든 정확히 그것을 지운다. 한 트랜잭션이라 둘이 될 수가 없다.
           */
          handleDrop(view, event, slice, moved) {
            if (!moved) return false
            const from = dragFromKey.getState(view.state)
            if (from == null) return false
            const node = view.state.doc.nodeAt(from)
            if (!node || node.type.name !== 'image') return false

            const drag = event as DragEvent
            const at = posOrNearest(view, drag.clientX, drag.clientY)
            /* 자리를 못 찾아도 기본 놓기에 넘기지 않는다 — 그 길이 그림을 둘로 만든다 */
            const target = at == null ? null : dropPoint(view.state.doc, at, slice)
            if (target == null) { event.preventDefault(); return true }

            const tr = view.state.tr
            tr.delete(from, from + node.nodeSize)
            const where = tr.mapping.map(target)
            tr.insert(where, node)
            const landed = tr.doc.nodeAt(where)
            /* 옮긴 뒤에도 고른 채로 둔다 — 워드처럼 바로 이어서 다룰 수 있게 */
            if (landed && landed.type.name === 'image') tr.setSelection(NodeSelection.create(tr.doc, where))
            tr.setMeta(dragFromKey, null)
            view.dispatch(tr)
            event.preventDefault()
            return true
          },
        },
      }),
      /**
       * 못 물린 그림 자리 지키기 — 워드의 「그림을 표시할 수 없습니다」.
       *
       * 주소가 깨졌거나 아예 비어 있으면 브라우저는 알맹이를 0×0 으로 잡는다.
       * 그러면 상자가 통째로 쪼그라들어(재어 보니 빈 주소는 높이 0px) 사람이 그 그림을
       * 다시 클릭해 지울 수도, 주소를 고칠 수도 없다 — 문서에서 영영 못 꺼낸다.
       * 그래서 표시를 붙여 최소 치수와 가상 테두리가 걸리게 한다(CSS: [data-jan-broken]).
       *
       * 표시는 DOM 을 직접 건드리지 않고 데코레이션으로 얹는다. ProseMirror 가 관리하는
       * 요소에 속성을 손으로 붙이면 그쪽 DOMObserver 가 「밖에서 고쳤다」 로 읽어 다시
       * 그리고, 다시 그린 그림이 또 error 를 내어 맴돌 수 있다.
       */
      new Plugin<BrokenState>({
        key: brokenKey,
        state: {
          init: (_, state) => ({ srcs: new Set<string>(), decos: brokenDecos(state.doc, new Set()) }),
          apply(tr, value, _old, next) {
            const 알림 = tr.getMeta(brokenKey) as { src: string; broken: boolean } | undefined
            let srcs = value.srcs
            if (알림 && srcs.has(알림.src) !== 알림.broken) {
              srcs = new Set(srcs)
              if (알림.broken) srcs.add(알림.src)
              else srcs.delete(알림.src)
            }
            if (srcs === value.srcs && !tr.docChanged) return value
            return { srcs, decos: brokenDecos(next.doc, srcs) }
          },
        },
        props: {
          decorations(state) { return brokenKey.getState(state)?.decos ?? null },
        },
        view(editorView) {
          const 적기 = (event: Event, broken: boolean) => {
            const el = event.target as HTMLElement | null
            if (!el || el.tagName !== 'IMG') return
            const pos = imagePosFromDom(editorView, el)
            if (pos == null) return
            const src = editorView.state.doc.nodeAt(pos)?.attrs.src
            /* 저장소 주소는 화면에 1×1 빈 그림을 놓고 나중에 물린다 — 못 물린 것이 아니다 */
            if (typeof src !== 'string' || !src || src.startsWith('jan-blob://')) return
            const now = brokenKey.getState(editorView.state)
            if (!now || now.srcs.has(src) === broken) return
            editorView.dispatch(
              editorView.state.tr.setMeta(brokenKey, { src, broken }).setMeta('addToHistory', false)
            )
          }
          const onError = (e: Event) => 적기(e, true)
          const onLoad = (e: Event) => 적기(e, false)
          /* load·error 는 거품이 일지 않으므로 잡는 단계(capture)에서 듣는다 */
          editorView.dom.addEventListener('error', onError, true)
          editorView.dom.addEventListener('load', onLoad, true)
          return {
            destroy() {
              editorView.dom.removeEventListener('error', onError, true)
              editorView.dom.removeEventListener('load', onLoad, true)
            },
          }
        },
      }),
      new Plugin({
        key: new PluginKey('janImageNatural'),
        view() {
          /**
           * 원래 크기를 알아야 「원래 크기로」·세로 자르기·예약 상자가 된다 —
           * 그려진 뒤 읽어 노드에 적어 둔다.
           *
           * 한 번 적고 마는 것이 아니라 「지금 물린 그림과 같은가」 를 본다.
           * 예전에는 :not([data-nw]) 만 훑고 node.attrs.nw 가 있으면 건너뛰었다. 그러면
           * 같은 노드의 src 를 다른 그림으로 갈아 끼울 때(그림 편집·형식 바꾸기·paint) 옛
           * 치수가 그대로 남는다 — 재어 보니 200×200 자리에 500×800 을 넣어도 data-nw 는
           * 200/200, aspect-ratio 도 200/200 이라 상자가 200×200 인 채 그림만 찌그러졌고,
           * 700×2600 으로 바꿔도 쪽 수가 1쪽에서 꿈쩍하지 않았다.
           */
          const measure = () => {
            /* 편집기가 이미 걷혔을 수 있다 — 그림이 늦게 와서 부르는 자리라 흔하다.
               그대로 두면 「editor view is not available」 로 터진다. */
            if (!editor || editor.isDestroyed || !editor.view?.dom) return
            const root = editor.view.dom as HTMLElement
            root.querySelectorAll<HTMLImageElement>('img.jan-img-el').forEach((img) => {
              /* 먼저 화면만 보고 거른다 — 적어 둔 값이 지금 물린 그림과 같으면 더 볼 것이 없다.
                 update 는 트랜잭션마다 오고 그림이 스무 장이면 스무 번이라, 문서에서 자리를
                 찾는 일(posAtDOM)까지 가기 전에 끊어야 한다. */
              const had = Number(img.getAttribute('data-nw')) || 0
              const hadH = Number(img.getAttribute('data-nh')) || 0
              if (had && had === img.naturalWidth && hadH === img.naturalHeight) return
              /* 아직 진짜 그림이 아니다 — 저장소 주소는 1×1 빈 그림을 놓고 나중에 물리고,
                 갈아 끼운 새 그림도 물리기 전에는 0 이다. 물리면 그때 다시 본다. */
              if (had && img.naturalWidth <= 1) {
                img.addEventListener('load', () => measure(), { once: true })
                return
              }
              let pos: number
              try { pos = editor.view.posAtDOM(img, 0) } catch { return }
              if (pos == null || pos < 0) return
              const node = editor.state.doc.nodeAt(pos)
              if (!node || node.type.name !== 'image') return

              /* SVG 는 그림이 스스로 밝힌 치수가 먼저다 — 물리기를 기다릴 것도 없다.
                 브라우저가 주는 naturalWidth 는 viewBox 만 있는 SVG 에서 300×150 을 맞춰
                 넣은 엉뚱한 값이고, 비율이 극단이면 아예 0 이 되어 아래 빗장에 영영 걸린다. */
              const svgSize = svgIntrinsicSize(node.attrs.src)
              /* 아직 진짜 그림이 아니다 — 1×1 을 「원래 크기」 로 적으면 비율이 통째로 망가진다 */
              if (!svgSize && img.naturalWidth <= 1) {
                img.addEventListener('load', () => measure(), { once: true })
                return
              }
              const nw = svgSize ? svgSize.nw : img.naturalWidth
              const nh = svgSize ? svgSize.nh : img.naturalHeight
              /* 노드에 이미 같은 값이 적혀 있으면 트랜잭션을 내지 않는다 — 여기서 멎는다.
                 (viewBox 만 있는 SVG 는 data-nw 와 naturalWidth 가 늘 어긋나 위 거름망을
                 지나온다. 그때 이 빗장이 없으면 매 update 마다 문서를 고쳐 맴돈다.) */
              if (node.attrs.nw === nw && node.attrs.nh === nh) return
              editor.view.dispatch(
                editor.view.state.tr
                  .setNodeMarkup(pos, undefined, { ...node.attrs, nw, nh })
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
