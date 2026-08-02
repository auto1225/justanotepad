/**
 * 도장 — 이름을 넣으면 인장을 찍어 준다.
 *
 * 결재란에 「(인)」 이라고 적어 두고 인쇄해서 손으로 찍던 일을 문서 안에서 끝낸다.
 * 서명란(SignaturePanel)은 서양식 서명줄이라 다른 물건이다 — 이것은 인장이다.
 *
 * 만들어 낸 그림은 배경이 비어 있다. 도장은 서명줄이나 이름 위에 겹쳐 찍는 것이라
 * 흰 바탕이 깔려 있으면 밑에 있는 글자를 지운다. 그래서 글자 자리를 파내어 뚫는다.
 *
 * 글자를 앉히는 셈(layoutStamp)만 따로 떼어 두었다 — 그리기는 브라우저가 있어야 하지만
 * 몇 칸으로 나눌지, 어느 칸에 몇 자를 넣을지는 브라우저 없이도 따져 볼 수 있다.
 */

/** 인장 모양 */
export const STAMP_SHAPES = [
  { key: 'circle', label: '원형', hint: '개인 인감 · 직인에 흔하다' },
  { key: 'square', label: '사각', hint: '법인 인감 · 낙관' },
  { key: 'rounded', label: '둥근 사각', hint: '모서리를 죽인 사각' },
  { key: 'ellipse', label: '타원', hint: '가로로 긴 직인' },
] as const
export type StampShape = (typeof STAMP_SHAPES)[number]['key']

/** 새김 — 주문(양각)은 바탕이 붉고 글자가 비며, 백문(음각)은 그 반대다 */
export const STAMP_CARVES = [
  { key: 'relief', label: '양각 (주문)', hint: '붉은 바탕에 흰 글자 — 인감·직인' },
  { key: 'intaglio', label: '음각 (백문)', hint: '흰 바탕에 붉은 글자 — 낙관' },
] as const
export type StampCarve = (typeof STAMP_CARVES)[number]['key']

/** 읽는 차례 — 전통은 오른쪽 줄부터 왼쪽으로 내려온다 */
export type StampOrder = 'traditional' | 'modern'

/** 자주 쓰는 크기 (mm) */
export const STAMP_SIZES = [
  { mm: 15, label: '개인 도장 15mm' },
  { mm: 20, label: '사용 도장 20mm' },
  { mm: 25, label: '직인 25mm' },
  { mm: 30, label: '법인 도장 30mm' },
] as const

/** 인주 빛깔 */
export const STAMP_INKS = [
  { key: '#c8102e', label: '인주 (주홍)' },
  { key: '#9b1b30', label: '진한 주홍' },
  { key: '#1a1a1a', label: '먹 (검정)' },
  { key: '#1c3f95', label: '남색' },
] as const

/** 글꼴 — 전서체는 깔려 있는 컴퓨터가 드물어 명조로 물러선다 */
export const STAMP_FONTS = [
  { key: 'serif', label: '명조 (전통)', stack: "'HCR Batang','Batang','BatangChe','Nanum Myeongjo','Noto Serif KR','Songti SC',serif" },
  { key: 'gungseo', label: '궁서', stack: "'Gungsuh','GungsuhChe','Gungseo','HCR Batang','Batang',serif" },
  { key: 'gothic', label: '고딕 (현대)', stack: "'Malgun Gothic','맑은 고딕','Noto Sans KR','Apple SD Gothic Neo',sans-serif" },
] as const
export type StampFont = (typeof STAMP_FONTS)[number]['key']

export interface StampOptions {
  text: string
  shape?: StampShape
  carve?: StampCarve
  order?: StampOrder
  /** 가로로 한 줄에 늘어놓는다 — 「대한민국」 같은 현대식 직인 */
  horizontal?: boolean
  color?: string
  font?: StampFont
  sizeMm?: number
  /** 오래 쓴 도장처럼 가장자리를 성기게 한다 */
  worn?: boolean
}

/** 인장 한 칸 — 값은 0~1 사이의 몫으로, 글자 넣을 네모 안에서의 자리다 */
export interface StampCell {
  ch: string
  /** 왼쪽 위 모서리 (0~1) */
  x: number
  y: number
  /** 칸 크기 (0~1) */
  w: number
  h: number
}

/**
 * 글자를 줄로 나눈다.
 *
 * 세 글자는 특별하다 — 성 한 자가 오른쪽 줄을 통째로 쓰고 이름 두 자가 왼쪽에 선다.
 * 나머지는 되도록 네모지게 나누고, 남는 글자는 오른쪽 줄부터 채운다
 * (전통 차례가 오른쪽에서 왼쪽이라, 먼저 읽는 줄이 길어야 눈이 편하다).
 */
export function splitColumns(n: number): number[] {
  if (n <= 0) return []
  if (n === 3) return [1, 2] // 오른쪽 줄부터 — 성 한 자, 이름 두 자
  const rows = Math.ceil(Math.sqrt(n))
  const cols = Math.ceil(n / rows)
  const base = Math.floor(n / cols)
  const extra = n % cols
  return Array.from({ length: cols }, (_, i) => base + (i < extra ? 1 : 0))
}

/**
 * 글자를 인장 안에 앉힌다.
 *
 * 돌려주는 자리는 「글자 넣을 네모」 안에서의 몫이다 — 원형이든 사각이든
 * 그 네모를 어디에 잡을지는 그리는 쪽이 정한다 (원은 안에 든 정사각형).
 */
export function layoutStamp(text: string, opts: { order?: StampOrder; horizontal?: boolean } = {}): StampCell[] {
  const chars = [...text.trim()].filter((c) => c.trim() !== '')
  if (chars.length === 0) return []
  const order = opts.order || 'traditional'

  if (opts.horizontal || chars.length === 1) {
    const n = chars.length
    return chars.map((ch, i) => ({ ch, x: i / n, y: 0, w: 1 / n, h: 1 }))
  }

  const counts = splitColumns(chars.length)
  const cols = counts.length
  const cells: StampCell[] = []
  let k = 0
  for (let c = 0; c < cols; c += 1) {
    const rows = counts[c]
    /* 전통은 오른쪽 줄부터 읽는다 — 첫 줄이 오른쪽 끝에 선다 */
    const colIndex = order === 'traditional' ? cols - 1 - c : c
    for (let r = 0; r < rows; r += 1) {
      cells.push({ ch: chars[k], x: colIndex / cols, y: r / rows, w: 1 / cols, h: 1 / rows })
      k += 1
    }
  }
  return cells
}

/** 같은 이름이면 늘 같은 자리가 성기도록 — 찍을 때마다 달라지면 도장이 아니다 */
function seeded(text: string): () => number {
  let s = 0
  for (let i = 0; i < text.length; i += 1) s = (s * 31 + text.charCodeAt(i)) >>> 0
  s = s || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 0xffffffff
  }
}

const MM_PER_IN = 25.4
/** 찍어 낼 때의 촘촘함 — 600dpi 면 30mm 도장이 709px 이라 인쇄해도 가장자리가 안 튄다 */
const STAMP_DPI = 600

export const stampPixels = (mm: number) => Math.max(32, Math.round((mm * STAMP_DPI) / MM_PER_IN))

/** 모양대로 길을 낸다 (canvas 는 roundRect 가 없는 곳이 있어 손으로 그린다) */
function tracePath(ctx: CanvasRenderingContext2D, shape: StampShape, x: number, y: number, w: number, h: number) {
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
  } else if (shape === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else if (shape === 'rounded') {
    const r = Math.min(w, h) * 0.18
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  } else {
    ctx.rect(x, y, w, h)
  }
}

/** 글자 넣을 네모 — 원 안에서는 안에 든 정사각형이라 지름의 0.707 배다 */
function textBox(shape: StampShape, size: number, inset: number) {
  const inner = size - inset * 2
  if (shape === 'circle') {
    const side = inner * 0.707
    const off = (size - side) / 2
    return { x: off, y: off, w: side, h: side }
  }
  if (shape === 'ellipse') {
    const w = inner * 0.82
    const h = inner * 0.6
    return { x: (size - w) / 2, y: (size - h) / 2, w, h }
  }
  const pad = inner * 0.08
  return { x: inset + pad, y: inset + pad, w: inner - pad * 2, h: inner - pad * 2 }
}

/** 글자 먹이 정확히 이 높이가 되는 글자 크기 (글꼴마다 여백이 달라 재 보며 좁힌다) */
function fitInkHeight(ctx: CanvasRenderingContext2D, ch: string, stack: string, h: number): number {
  let size = h
  for (let i = 0; i < 8; i += 1) {
    ctx.font = `${size}px ${stack}`
    const th = inkHeight(ctx, ch, size)
    if (th <= 0) break
    const k = h / th
    if (Math.abs(k - 1) < 0.01) break
    size *= k
  }
  return size
}

function inkHeight(ctx: CanvasRenderingContext2D, ch: string, size: number): number {
  const m = ctx.measureText(ch)
  return (m.actualBoundingBoxAscent || size * 0.8) + (m.actualBoundingBoxDescent || size * 0.2)
}

/** 늘리고 줄이는 데에도 한도가 있다 — 이보다 심하면 글자가 아니라 얼룩으로 보인다 */
const MAX_STRETCH = 1.8

/**
 * 도장을 그린다 — 배경은 비워 둔다.
 *
 * 양각은 붉은 바탕을 채운 뒤 글자 자리를 파낸다(destination-out). 도장은 밑에 있는
 * 서명줄 위에 겹쳐 찍는 것이라, 파내지 않고 흰 글자를 얹으면 밑줄이 가려진다.
 */
export function drawStamp(canvas: HTMLCanvasElement, opts: StampOptions): void {
  const shape = opts.shape || 'circle'
  const carve = opts.carve || 'relief'
  const color = opts.color || STAMP_INKS[0].key
  const stack = (STAMP_FONTS.find((f) => f.key === (opts.font || 'serif')) || STAMP_FONTS[0]).stack
  const size = canvas.width
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, size, canvas.height)

  const ring = size * (carve === 'relief' ? 0.055 : 0.04)
  const boxH = shape === 'ellipse' ? size * 0.68 : size
  const top = (canvas.height - boxH) / 2

  ctx.fillStyle = color
  ctx.strokeStyle = color

  if (carve === 'relief') {
    /* 테두리와 바탕을 한 몸으로 채운다 */
    tracePath(ctx, shape, ring / 2, top + ring / 2, size - ring, boxH - ring)
    ctx.fill()
  } else {
    /* 백문은 테두리만 두른다 */
    ctx.lineWidth = ring
    tracePath(ctx, shape, ring / 2, top + ring / 2, size - ring, boxH - ring)
    ctx.stroke()
  }

  const box = textBox(shape, size, ring * 1.6)
  if (shape === 'ellipse') { box.y = top + (boxH - box.h) / 2 }
  const cells = layoutStamp(opts.text, { order: opts.order, horizontal: opts.horizontal })

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic' // 먹의 한가운데를 직접 맞춘다 — middle 은 글꼴의 em 한가운데라 어긋난다
  /* 양각은 글자 자리를 뚫고, 음각은 붉게 적는다 */
  ctx.globalCompositeOperation = carve === 'relief' ? 'destination-out' : 'source-over'

  const pad = 0.9 // 글자끼리 붙지 않게 조금 물린다
  for (const cell of cells) {
    const cw = cell.w * box.w * pad
    const chh = cell.h * box.h * pad
    const cx = box.x + (cell.x + cell.w / 2) * box.w
    const cy = box.y + (cell.y + cell.h / 2) * box.h

    /* 인장의 글자는 제 칸을 꽉 채운다 — 전서체가 길쭉한 것이 이 때문이다.
       고르게 줄이면 「홍길동」 처럼 한 자가 한 줄을 쓰는 도장에서 그 줄에만
       빈 띠가 남아, 붉은 자리가 휑하니 비어 보인다. */
    let fs = fitInkHeight(ctx, cell.ch, stack, chh)
    ctx.font = `${fs}px ${stack}`
    let sx = cw / (ctx.measureText(cell.ch).width || fs)
    if (sx < 1 / MAX_STRETCH) {
      /* 칸이 너무 좁다 — 옆으로 짜부라뜨리는 대신 글자를 줄여 세로에 여유를 준다 */
      fs *= sx * MAX_STRETCH
      sx = 1 / MAX_STRETCH
      ctx.font = `${fs}px ${stack}`
    } else if (sx > MAX_STRETCH) {
      sx = MAX_STRETCH
    }

    const m = ctx.measureText(cell.ch)
    const asc = m.actualBoundingBoxAscent || fs * 0.8
    const desc = m.actualBoundingBoxDescent || fs * 0.2
    ctx.save()
    ctx.translate(cx, cy + (asc - desc) / 2)
    ctx.scale(sx, 1)
    ctx.fillText(cell.ch, 0, 0)
    ctx.restore()
  }

  if (opts.worn) {
    /* 오래 쓴 도장처럼 성기게 — 같은 이름이면 늘 같은 자리다 */
    const rnd = seeded(opts.text)
    ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 90; i += 1) {
      const a = rnd() * Math.PI * 2
      const rr = (0.5 + rnd() * 0.52) * size * 0.5
      ctx.beginPath()
      ctx.arc(size / 2 + Math.cos(a) * rr, canvas.height / 2 + Math.sin(a) * rr, size * (0.004 + rnd() * 0.016), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.globalCompositeOperation = 'source-over'
}

/** 도장을 그림 한 장으로 — 문서에 넣을 수 있는 꼴로 돌려준다 */
export function makeStampPng(opts: StampOptions): string {
  const mm = opts.sizeMm || 25
  const px = stampPixels(mm)
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = opts.shape === 'ellipse' ? Math.round(px * 0.68) : px
  drawStamp(canvas, opts)
  return canvas.toDataURL('image/png')
}

/**
 * 찍어 둔 도장을 사진·스캔에서 떠낸다.
 *
 * 종이를 찍은 그림은 바탕이 순백이 아니다 — 누런 기가 돌고 그늘이 진다.
 * 그래서 「흰색만 지우기」 로는 테두리에 지저분한 테가 남는다. 밝기를 보고
 * 밝을수록 비우고 어두울수록 진하게 남기면, 종이 빛깔이 무엇이든 인영만 떠온다.
 *
 * @param threshold 이보다 밝으면 아주 비운다 (0~255)
 * @param ink 주면 그 빛깔로 물들인다 — 흐릿하게 찍힌 도장을 또렷하게 되살린다
 */
export function inkifyScan(src: string, threshold = 200, ink?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('그릴 자리를 얻지 못했다')); return }
      ctx.drawImage(img, 0, 0)
      let data: ImageData
      try { data = ctx.getImageData(0, 0, canvas.width, canvas.height) } catch (e) { reject(e); return }
      const px = data.data
      const tint = ink ? hexRgb(ink) : null
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
        /* 문턱보다 밝으면 비우고, 어두울수록 진하게 남긴다 */
        const a = lum >= threshold ? 0 : Math.round(255 * Math.min(1, (threshold - lum) / Math.max(1, threshold * 0.55)))
        px[i + 3] = Math.min(px[i + 3], a)
        if (tint && a > 0) { px[i] = tint[0]; px[i + 1] = tint[1]; px[i + 2] = tint[2] }
      }
      ctx.putImageData(data, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('그림을 읽지 못했다'))
    img.src = src
  })
}

function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [200, 16, 46]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * 도장을 커서 자리에 얹기 위해 얼마나 밀어야 하는지.
 *
 * 이 앱의 그림은 블록이라 글자 사이에 끼지 못하고 문단 뒤 제 줄에 선다.
 * 도장은 종이 위에 겹쳐 찍는 물건이라 그러면 쓸모가 없다 — 그래서 글 앞으로 띄운 뒤
 * 제자리(문단 바로 아래 왼쪽)에서 커서가 있던 자리까지 밀어 준다.
 *
 * @param caret 커서 자리 (view.coordsAtPos)
 * @param box   밀기 전 도장이 놓인 자리 (getBoundingClientRect)
 */
export function stampOffset(
  caret: { left: number; top: number; bottom: number },
  box: { left: number; top: number; width: number; height: number },
): { dx: number; dy: number } {
  return {
    dx: Math.round(caret.left - box.left - box.width / 2),
    dy: Math.round((caret.top + caret.bottom) / 2 - (box.top + box.height / 2)),
  }
}

/* ── 만들어 둔 도장 서랍 ─────────────────────────────────────────────
   도장은 한 번 만들고 여러 문서에 되풀이해 찍는 물건이라 서랍에 넣어 둔다. */

export interface SavedStamp {
  id: string
  name: string
  src: string
  mm: number
}

const DRAWER_KEY = 'jan-v2-stamps'

export function loadStamps(): SavedStamp[] {
  try {
    const raw = localStorage.getItem(DRAWER_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((s) => s && typeof s.src === 'string') : []
  } catch { return [] }
}

export function saveStamp(stamp: Omit<SavedStamp, 'id'>): SavedStamp[] {
  const list = loadStamps()
  const id = `s${list.length}-${stamp.name}`
  const next = [{ ...stamp, id }, ...list.filter((s) => s.id !== id)].slice(0, 24)
  try { localStorage.setItem(DRAWER_KEY, JSON.stringify(next)) } catch { /* 자리가 없으면 이번 것만 못 담는다 */ }
  return next
}

export function removeStamp(id: string): SavedStamp[] {
  const next = loadStamps().filter((s) => s.id !== id)
  try { localStorage.setItem(DRAWER_KEY, JSON.stringify(next)) } catch { /* 위와 같다 */ }
  return next
}
