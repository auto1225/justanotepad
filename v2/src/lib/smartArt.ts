/**
 * 스마트 도해 — 워드 「삽입 › SmartArt」 자리.
 *
 * 글 목록만 적으면 배치는 우리가 맡는다. 항목을 더하거나 지우면 자리와 크기가
 * 저절로 다시 잡힌다 (워드도 그렇게 동작한다). 그린 결과는 SVG 라 인쇄·PDF 에 그대로 간다.
 */

export interface SmartSpec {
  layout: string
  items: string[]
  /** 항목 아래 붙는 설명 (있으면 두 줄로 그린다) */
  notes?: string[]
  palette?: string
  width?: number
  height?: number
  title?: string
}

export const SMART_PALETTES: Record<string, string[]> = {
  기본: ['#4472c4', '#5b9bd5', '#70ad47', '#ffc000', '#ed7d31', '#a5a5a5'],
  차분: ['#42618c', '#5b7db1', '#7fa8c9', '#a8c5da', '#8fa8bd', '#6b8ca8'],
  선명: ['#e63946', '#f77f00', '#fcbf49', '#06d6a0', '#118ab2', '#7209b7'],
  단색: ['#0b3d91', '#1e5fbf', '#3d82d9', '#69a5e8', '#9cc6f2', '#b9d6f7'],
  회색: ['#3b3b3b', '#575757', '#737373', '#8f8f8f', '#ababab', '#c7c7c7'],
}

export interface SmartLayout {
  key: string
  group: string
  label: string
  hint: string
  /** 이 배치가 잘 담는 항목 수 */
  best: [number, number]
}

export const SMART_LAYOUTS: SmartLayout[] = [
  { key: 'list-basic', group: '목록', label: '기본 목록', hint: '나란한 항목을 한 줄씩', best: [3, 8] },
  { key: 'list-boxes', group: '목록', label: '상자 목록', hint: '항목마다 상자 하나 — 가로로 배치', best: [3, 6] },
  { key: 'list-number', group: '목록', label: '번호 목록', hint: '차례가 있는 항목', best: [3, 7] },
  { key: 'process-arrow', group: '절차', label: '화살표 절차', hint: '왼쪽에서 오른쪽으로 흐른다', best: [3, 5] },
  { key: 'process-chevron', group: '절차', label: '갈매기 절차', hint: '단계가 이어짐을 강조', best: [3, 6] },
  { key: 'process-step', group: '절차', label: '계단 절차', hint: '단계마다 올라간다', best: [3, 5] },
  { key: 'process-vertical', group: '절차', label: '세로 절차', hint: '위에서 아래로', best: [3, 6] },
  { key: 'cycle-circle', group: '주기', label: '원형 주기', hint: '돌고 도는 과정', best: [3, 7] },
  { key: 'cycle-gear', group: '주기', label: '톱니 주기', hint: '맞물려 돌아가는 것', best: [3, 3] },
  { key: 'hier-org', group: '계층', label: '조직도', hint: '맨 위 하나, 아래로 갈라짐', best: [3, 7] },
  { key: 'hier-tree', group: '계층', label: '가로 계층', hint: '왼쪽 위에서 오른쪽으로', best: [3, 7] },
  { key: 'rel-balance', group: '관계', label: '균형', hint: '두 쪽을 견준다', best: [2, 6] },
  { key: 'rel-venn', group: '관계', label: '겹치는 원', hint: '공통점과 차이', best: [2, 4] },
  { key: 'rel-funnel', group: '관계', label: '깔때기', hint: '좁혀 가며 걸러 낸다', best: [3, 5] },
  { key: 'matrix-4', group: '행렬', label: '사분면', hint: '두 잣대로 넷으로 나눔', best: [4, 4] },
  { key: 'matrix-grid', group: '행렬', label: '격자', hint: '같은 무게의 여러 칸', best: [4, 9] },
  { key: 'pyramid-up', group: '피라미드', label: '피라미드', hint: '아래가 넓은 층', best: [3, 5] },
  { key: 'pyramid-down', group: '피라미드', label: '역피라미드', hint: '위가 넓은 층', best: [3, 5] },
]

export const SMART_GROUPS = [...new Set(SMART_LAYOUTS.map((l) => l.group))]

export const DEFAULT_SMART: SmartSpec = {
  layout: 'process-chevron',
  items: ['첫째 단계', '둘째 단계', '셋째 단계'],
  palette: '기본',
  width: 520,
  height: 200,
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = (v: number) => (Math.round(v * 100) / 100).toString()

function colors(spec: SmartSpec): string[] {
  const raw = SMART_PALETTES[spec.palette || '기본'] || SMART_PALETTES['기본']
  return raw.map((c) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#4472c4'))
}

/** 글 상자 하나 — 상자 안에 여러 줄로 나눠 넣는다 (글꼴 크기는 칸에 맞춰 줄인다) */
function label(text: string, x: number, y: number, w: number, h: number, color = '#fff', size = 13, weight = 600): string {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const perLine = Math.max(1, Math.floor(w / (size * 0.62)))
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    if (!cur.length) cur = word
    else if ((cur + ' ' + word).length <= perLine) cur += ' ' + word
    else { lines.push(cur); cur = word }
  }
  if (cur) lines.push(cur)
  const maxLines = Math.max(1, Math.floor(h / (size * 1.25)))
  const shown = lines.slice(0, maxLines)
  const startY = y + h / 2 - ((shown.length - 1) * size * 1.25) / 2 + size * 0.35
  return shown.map((line, i) =>
    `<text x="${n2(x + w / 2)}" y="${n2(startY + i * size * 1.25)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`
  ).join('')
}

/** 스마트 도해 한 장을 SVG 로 */
export function smartSvg(spec: SmartSpec): string {
  const w = spec.width || 520
  const h = spec.height || 200
  const pal = colors(spec)
  const items = spec.items.length ? spec.items : ['항목']
  const titleH = spec.title ? 24 : 0
  const body = draw(spec.layout, items, spec, pal, { x: 6, y: 6 + titleH, w: w - 12, h: h - 12 - titleH })
  const title = spec.title
    ? `<text x="${n2(w / 2)}" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#1c1f26">${esc(spec.title)}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(spec.title || '도해')}"><rect width="${w}" height="${h}" fill="#fff"/>${title}${body}</svg>`
}

interface Box { x: number; y: number; w: number; h: number }

function draw(layout: string, items: string[], spec: SmartSpec, pal: string[], box: Box): string {
  const note = (i: number) => spec.notes?.[i] || ''
  const n = items.length
  const out: string[] = []
  const color = (i: number) => pal[i % pal.length]

  switch (layout) {
    case 'list-basic': {
      const rowH = Math.min(46, box.h / n)
      items.forEach((t, i) => {
        const y = box.y + i * rowH
        out.push(`<rect x="${box.x}" y="${n2(y + 2)}" width="${box.w}" height="${n2(rowH - 6)}" rx="4" fill="${color(i)}" fill-opacity="0.12"/>`)
        out.push(`<rect x="${box.x}" y="${n2(y + 2)}" width="6" height="${n2(rowH - 6)}" rx="3" fill="${color(i)}"/>`)
        out.push(label(t, box.x + 14, y + 2, box.w - 20, rowH - 6, '#1c1f26', 13, 600).replace(/text-anchor="middle"/g, 'text-anchor="start"').replace(/x="[\d.]+"/g, `x="${n2(box.x + 16)}"`))
      })
      break
    }
    case 'list-boxes': {
      const gap = 10
      const bw = (box.w - gap * (n - 1)) / n
      items.forEach((t, i) => {
        const x = box.x + i * (bw + gap)
        out.push(`<rect x="${n2(x)}" y="${box.y}" width="${n2(bw)}" height="${box.h}" rx="6" fill="${color(i)}"/>`)
        out.push(label(t, x, box.y, bw, note(i) ? box.h * 0.55 : box.h))
        if (note(i)) out.push(label(note(i), x, box.y + box.h * 0.55, bw, box.h * 0.4, '#ffffffcc', 10, 400))
      })
      break
    }
    case 'list-number': {
      const rowH = Math.min(44, box.h / n)
      items.forEach((t, i) => {
        const y = box.y + i * rowH
        out.push(`<circle cx="${n2(box.x + 16)}" cy="${n2(y + rowH / 2 - 2)}" r="13" fill="${color(i)}"/>`)
        out.push(`<text x="${n2(box.x + 16)}" y="${n2(y + rowH / 2 + 3)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${i + 1}</text>`)
        out.push(`<text x="${n2(box.x + 38)}" y="${n2(y + rowH / 2 + 3)}" font-size="13" font-weight="600" fill="#1c1f26">${esc(t)}</text>`)
      })
      break
    }
    case 'process-arrow': {
      const gap = 12
      const bw = (box.w - gap * (n - 1)) / n
      items.forEach((t, i) => {
        const x = box.x + i * (bw + gap)
        out.push(`<rect x="${n2(x)}" y="${box.y}" width="${n2(bw)}" height="${box.h}" rx="6" fill="${color(i)}"/>`)
        out.push(label(t, x, box.y, bw, box.h))
        if (i < n - 1) {
          const ax = x + bw + 1
          out.push(`<path d="M${n2(ax)},${n2(box.y + box.h / 2 - 5)} L${n2(ax + gap - 3)},${n2(box.y + box.h / 2)} L${n2(ax)},${n2(box.y + box.h / 2 + 5)} Z" fill="#98a2b3"/>`)
        }
      })
      break
    }
    case 'process-chevron': {
      const overlap = 14
      const bw = (box.w + overlap * (n - 1)) / n
      items.forEach((t, i) => {
        const x = box.x + i * (bw - overlap)
        const y = box.y, hh = box.h
        const tip = Math.min(18, bw * 0.22)
        out.push(`<path d="M${n2(x)},${n2(y)} L${n2(x + bw - tip)},${n2(y)} L${n2(x + bw)},${n2(y + hh / 2)} L${n2(x + bw - tip)},${n2(y + hh)} L${n2(x)},${n2(y + hh)} L${n2(x + tip)},${n2(y + hh / 2)} Z" fill="${color(i)}"/>`)
        out.push(label(t, x + tip, y, bw - tip * 2, hh))
      })
      break
    }
    case 'process-step': {
      const bw = box.w / n
      const stepH = box.h / (n + 1)
      items.forEach((t, i) => {
        const x = box.x + i * bw
        const hh = stepH * (i + 1)
        const y = box.y + box.h - hh
        out.push(`<rect x="${n2(x + 3)}" y="${n2(y)}" width="${n2(bw - 6)}" height="${n2(hh - 3)}" rx="5" fill="${color(i)}"/>`)
        out.push(label(t, x + 3, y, bw - 6, hh - 3, '#fff', 12))
      })
      break
    }
    case 'process-vertical': {
      const rowH = box.h / n
      items.forEach((t, i) => {
        const y = box.y + i * rowH
        out.push(`<rect x="${n2(box.x + box.w * 0.1)}" y="${n2(y + 3)}" width="${n2(box.w * 0.8)}" height="${n2(rowH - 14)}" rx="6" fill="${color(i)}"/>`)
        out.push(label(t, box.x + box.w * 0.1, y + 3, box.w * 0.8, rowH - 14))
        if (i < n - 1) out.push(`<path d="M${n2(box.x + box.w / 2 - 5)},${n2(y + rowH - 10)} L${n2(box.x + box.w / 2 + 5)},${n2(y + rowH - 10)} L${n2(box.x + box.w / 2)},${n2(y + rowH - 2)} Z" fill="#98a2b3"/>`)
      })
      break
    }
    case 'cycle-circle': {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2
      const r = Math.min(box.w, box.h) / 2 - 34
      const rr = Math.max(26, Math.min(42, (2 * Math.PI * r) / (n * 2.6)))
      items.forEach((t, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
        const a2 = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2
        out.push(`<path d="M${n2(cx + (r + rr * 0.2) * Math.cos(a2 - 0.25))},${n2(cy + (r + rr * 0.2) * Math.sin(a2 - 0.25))} A${n2(r)},${n2(r)} 0 0 1 ${n2(cx + (r + rr * 0.2) * Math.cos(a2 + 0.25))},${n2(cy + (r + rr * 0.2) * Math.sin(a2 + 0.25))}" fill="none" stroke="#c3cbd6" stroke-width="2" marker-end=""/>`)
        out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(rr)}" fill="${color(i)}"/>`)
        out.push(label(t, x - rr, y - rr, rr * 2, rr * 2, '#fff', 11))
      })
      break
    }
    case 'cycle-gear': {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2
      const r = Math.min(box.w, box.h) / 3
      items.slice(0, 3).forEach((t, i) => {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2
        const x = cx + r * 0.8 * Math.cos(a), y = cy + r * 0.8 * Math.sin(a)
        out.push(gear(x, y, r * 0.72, color(i)))
        out.push(label(t, x - r * 0.5, y - r * 0.3, r, r * 0.6, '#fff', 11))
      })
      break
    }
    case 'hier-org': {
      const top = items[0] ?? ''
      const rest = items.slice(1)
      const bw = Math.min(150, box.w / Math.max(1, rest.length) - 10)
      const topW = Math.min(180, box.w * 0.4)
      const topX = box.x + (box.w - topW) / 2
      out.push(`<rect x="${n2(topX)}" y="${box.y}" width="${n2(topW)}" height="42" rx="6" fill="${color(0)}"/>`)
      out.push(label(top, topX, box.y, topW, 42))
      const y2 = box.y + box.h - 42
      rest.forEach((t, i) => {
        const x = box.x + (box.w / rest.length) * i + (box.w / rest.length - bw) / 2
        out.push(`<line x1="${n2(box.x + box.w / 2)}" y1="${box.y + 42}" x2="${n2(box.x + box.w / 2)}" y2="${n2(box.y + 42 + (box.h - 84) / 2)}" stroke="#b9c2cc" stroke-width="2"/>`)
        out.push(`<line x1="${n2(box.x + box.w / 2)}" y1="${n2(box.y + 42 + (box.h - 84) / 2)}" x2="${n2(x + bw / 2)}" y2="${n2(box.y + 42 + (box.h - 84) / 2)}" stroke="#b9c2cc" stroke-width="2"/>`)
        out.push(`<line x1="${n2(x + bw / 2)}" y1="${n2(box.y + 42 + (box.h - 84) / 2)}" x2="${n2(x + bw / 2)}" y2="${n2(y2)}" stroke="#b9c2cc" stroke-width="2"/>`)
        out.push(`<rect x="${n2(x)}" y="${n2(y2)}" width="${n2(bw)}" height="42" rx="6" fill="${color(i + 1)}"/>`)
        out.push(label(t, x, y2, bw, 42, '#fff', 12))
      })
      break
    }
    case 'hier-tree': {
      const top = items[0] ?? ''
      const rest = items.slice(1)
      const bw = Math.min(160, box.w * 0.42)
      const rowH = Math.min(40, (box.h - 8) / Math.max(1, rest.length))
      out.push(`<rect x="${box.x}" y="${n2(box.y + box.h / 2 - 21)}" width="${n2(bw)}" height="42" rx="6" fill="${color(0)}"/>`)
      out.push(label(top, box.x, box.y + box.h / 2 - 21, bw, 42))
      rest.forEach((t, i) => {
        const y = box.y + i * rowH
        const x = box.x + bw + 40
        out.push(`<path d="M${n2(box.x + bw)},${n2(box.y + box.h / 2)} C${n2(box.x + bw + 20)},${n2(box.y + box.h / 2)} ${n2(x - 20)},${n2(y + rowH / 2)} ${n2(x)},${n2(y + rowH / 2)}" fill="none" stroke="#b9c2cc" stroke-width="2"/>`)
        out.push(`<rect x="${n2(x)}" y="${n2(y + 2)}" width="${n2(box.w - bw - 44)}" height="${n2(rowH - 6)}" rx="5" fill="${color(i + 1)}" fill-opacity="0.16"/>`)
        out.push(`<text x="${n2(x + 10)}" y="${n2(y + rowH / 2 + 3)}" font-size="12" font-weight="600" fill="#1c1f26">${esc(t)}</text>`)
      })
      break
    }
    case 'rel-balance': {
      const half = Math.ceil(n / 2)
      const left = items.slice(0, half), right = items.slice(half)
      const cx = box.x + box.w / 2
      out.push(`<line x1="${n2(cx)}" y1="${box.y}" x2="${n2(cx)}" y2="${n2(box.y + box.h)}" stroke="#d5dbe3" stroke-width="2"/>`)
      const put = (arr: string[], x0: number, w0: number, shift: number) => arr.forEach((t, i) => {
        const rowH = Math.min(44, box.h / Math.max(1, arr.length))
        const y = box.y + i * rowH
        out.push(`<rect x="${n2(x0)}" y="${n2(y + 3)}" width="${n2(w0)}" height="${n2(rowH - 8)}" rx="6" fill="${color(i + shift)}"/>`)
        out.push(label(t, x0, y + 3, w0, rowH - 8, '#fff', 12))
      })
      put(left, box.x, box.w / 2 - 14, 0)
      put(right, cx + 14, box.w / 2 - 14, 3)
      break
    }
    case 'rel-venn': {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2
      const r = Math.min(box.w / (n + 1), box.h / 2) * 0.9
      items.forEach((t, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2
        const x = n === 2 ? cx + (i === 0 ? -r * 0.55 : r * 0.55) : cx + r * 0.6 * Math.cos(a)
        const y = n === 2 ? cy : cy + r * 0.6 * Math.sin(a)
        out.push(`<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}" fill="${color(i)}" fill-opacity="0.45"/>`)
        out.push(label(t, x - r * 0.8, y - 10, r * 1.6, 20, '#1c1f26', 12, 700))
      })
      break
    }
    case 'rel-funnel': {
      const rowH = box.h / n
      items.forEach((t, i) => {
        const shrink = (box.w * 0.34 * i) / Math.max(1, n - 1)
        const x = box.x + shrink / 2
        const w0 = box.w - shrink
        out.push(`<path d="M${n2(x)},${n2(box.y + i * rowH)} L${n2(x + w0)},${n2(box.y + i * rowH)} L${n2(x + w0 - box.w * 0.17 / Math.max(1, n - 1))},${n2(box.y + (i + 1) * rowH - 4)} L${n2(x + box.w * 0.17 / Math.max(1, n - 1))},${n2(box.y + (i + 1) * rowH - 4)} Z" fill="${color(i)}"/>`)
        out.push(label(t, x, box.y + i * rowH, w0, rowH - 4, '#fff', 12))
      })
      break
    }
    case 'matrix-4': {
      const cw = box.w / 2, ch = box.h / 2
      items.slice(0, 4).forEach((t, i) => {
        const x = box.x + (i % 2) * cw, y = box.y + Math.floor(i / 2) * ch
        out.push(`<rect x="${n2(x + 3)}" y="${n2(y + 3)}" width="${n2(cw - 6)}" height="${n2(ch - 6)}" rx="6" fill="${color(i)}"/>`)
        out.push(label(t, x + 3, y + 3, cw - 6, ch - 6))
      })
      break
    }
    case 'matrix-grid': {
      const cols = Math.ceil(Math.sqrt(n))
      const rows = Math.ceil(n / cols)
      const cw = box.w / cols, ch = box.h / rows
      items.forEach((t, i) => {
        const x = box.x + (i % cols) * cw, y = box.y + Math.floor(i / cols) * ch
        out.push(`<rect x="${n2(x + 3)}" y="${n2(y + 3)}" width="${n2(cw - 6)}" height="${n2(ch - 6)}" rx="6" fill="${color(i)}"/>`)
        out.push(label(t, x + 3, y + 3, cw - 6, ch - 6, '#fff', 12))
      })
      break
    }
    case 'pyramid-up':
    case 'pyramid-down': {
      const up = layout === 'pyramid-up'
      const rowH = box.h / n
      items.forEach((t, i) => {
        const k = up ? i : n - 1 - i
        const topW = (box.w * (k + 0.35)) / n
        const botW = (box.w * (k + 1.35)) / n
        const y = box.y + i * rowH
        const cx = box.x + box.w / 2
        const [wTop, wBot] = up ? [topW, botW] : [botW, topW]
        out.push(`<path d="M${n2(cx - wTop / 2)},${n2(y)} L${n2(cx + wTop / 2)},${n2(y)} L${n2(cx + wBot / 2)},${n2(y + rowH - 3)} L${n2(cx - wBot / 2)},${n2(y + rowH - 3)} Z" fill="${color(i)}"/>`)
        out.push(label(t, cx - Math.min(wTop, wBot) / 2, y, Math.min(wTop, wBot), rowH - 3, '#fff', 12))
      })
      break
    }
    default:
      return draw('list-boxes', items, spec, pal, box)
  }
  return out.join('')
}

/** 톱니바퀴 하나 */
function gear(cx: number, cy: number, r: number, fill: string): string {
  const teeth = 10
  const inner = r * 0.78
  const pts: string[] = []
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r : inner
    pts.push(`${n2(cx + rr * Math.cos(a))},${n2(cy + rr * Math.sin(a))}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 0.32)}" fill="#fff" fill-opacity="0.55"/>`
}

/** 배치가 담기 좋은 항목 수인지 — 창에서 안내로 쓴다 */
export function fitsWell(layout: string, count: number): boolean {
  const l = SMART_LAYOUTS.find((x) => x.key === layout)
  return !l || (count >= l.best[0] && count <= l.best[1])
}
