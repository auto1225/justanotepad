/**
 * 차트 — 워드 「삽입 › 차트」 자리.
 *
 * 워드는 엑셀을 띄워 데이터를 받지만, 우리는 문서 안에 데이터를 함께 담고
 * 그 자리에서 그린다. 그린 결과는 SVG 라서 인쇄·PDF·다른 프로그램에서도 그대로 보인다.
 * (그림으로 굽지 않으므로 숫자를 고치면 즉시 다시 그려진다)
 */

export type ChartType =
  | 'column' | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter' | 'radar' | 'combo'

export interface ChartSeries {
  name: string
  values: number[]
  /** combo 에서 이 계열만 선으로 */
  asLine?: boolean
  color?: string
  /** 선 굵기 (꺾은선·영역·혼합) */
  lineWidth?: number
  /** 점선으로 */
  dashed?: boolean
  /** 표식 모양 — 워드 「데이터 표식」 */
  marker?: 'circle' | 'square' | 'diamond' | 'none'
}

export interface ChartSpec {
  type: ChartType
  labels: string[]
  series: ChartSeries[]
  title?: string
  /** 범례 자리 — none 이면 숨긴다 */
  legend?: 'top' | 'bottom' | 'right' | 'none'
  /** 값 표시 */
  valueLabels?: boolean
  /** 눈금선 */
  grid?: boolean
  /** 쌓기 (막대·영역) */
  stacked?: boolean
  /** 가로/세로 축 이름 */
  axisX?: string
  axisY?: string
  palette?: string
  width?: number
  height?: number
  /** 아주 작은 미리보기 — 눈금 글자를 지우고 모양만 보여 준다 */
  mini?: boolean

  /* ── 아래는 워드 「차트 요소·서식」 에 해당하는 세부 ── */
  /** 값 축 최소·최대·눈금 간격 (비우면 우리가 알아서 잡는다) */
  axisMin?: number | null
  axisMax?: number | null
  axisStep?: number | null
  /** 값 축을 뒤집기 (큰 값이 아래로) */
  axisReverse?: boolean
  /** 숫자 표기 — 1,234 · 12% · ₩1,234 · 1.2천 */
  numberFormat?: 'plain' | 'comma' | 'percent' | 'currency' | 'compact'
  /** 값 표시 자리 */
  labelPos?: 'outside' | 'inside' | 'center'
  /** 보조 눈금선 */
  minorGrid?: boolean
  /** 추세선 — 첫 계열에 그린다 */
  trend?: 'none' | 'linear' | 'average'
  /** 제목 자리 */
  titlePos?: 'top' | 'none'
  /** 꾸밈 한 벌 (워드 「차트 스타일」) */
  chartStyle?: string
}

/** 차트 꾸밈 한 벌 — 워드 「차트 스타일」 갤러리 */
export const CHART_STYLES: Array<{ key: string; label: string; patch: Partial<ChartSpec> }> = [
  { key: 'plain', label: '기본', patch: { grid: true, minorGrid: false, valueLabels: false, legend: 'bottom' } },
  { key: 'clean', label: '깔끔', patch: { grid: false, minorGrid: false, valueLabels: true, legend: 'bottom' } },
  { key: 'grid', label: '눈금 강조', patch: { grid: true, minorGrid: true, valueLabels: false, legend: 'right' } },
  { key: 'label', label: '값 표시', patch: { grid: true, minorGrid: false, valueLabels: true, labelPos: 'outside', legend: 'top' } },
  { key: 'mono', label: '단색', patch: { palette: '단색회색', grid: true, valueLabels: false, legend: 'bottom' } },
  { key: 'bold', label: '선명', patch: { palette: '선명', grid: false, valueLabels: true, legend: 'bottom' } },
]

export const NUMBER_FORMATS: Array<{ key: NonNullable<ChartSpec['numberFormat']>; label: string; hint: string }> = [
  { key: 'plain', label: '그대로', hint: '1234' },
  { key: 'comma', label: '천 단위 쉼표', hint: '1,234' },
  { key: 'percent', label: '백분율', hint: '12%' },
  { key: 'currency', label: '통화', hint: '₩1,234' },
  { key: 'compact', label: '축약', hint: '1.2천 · 3.4만' },
]

export const TREND_LINES: Array<{ key: NonNullable<ChartSpec['trend']>; label: string; hint: string }> = [
  { key: 'none', label: '없음', hint: '' },
  { key: 'linear', label: '선형 추세선', hint: '최소제곱 직선' },
  { key: 'average', label: '이동 평균', hint: '이웃한 세 값의 평균' },
]

/** 숫자를 고른 표기로 */
export function formatNumber(v: number, mode: ChartSpec['numberFormat']): string {
  const n = Math.round(v * 100) / 100
  switch (mode) {
    case 'comma': return n.toLocaleString('ko-KR')
    case 'percent': return `${n}%`
    case 'currency': return `₩${n.toLocaleString('ko-KR')}`
    case 'compact': {
      const abs = Math.abs(n)
      if (abs >= 100000000) return `${Math.round(n / 10000000) / 10}억`
      if (abs >= 10000) return `${Math.round(n / 1000) / 10}만`
      if (abs >= 1000) return `${Math.round(n / 100) / 10}천`
      return String(n)
    }
    default: return String(n)
  }
}

/** 색 묶음 — 워드의 「색 변경」 자리 */
export const CHART_PALETTES: Record<string, string[]> = {
  기본: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'],
  차분: ['#5b7db1', '#7fa8c9', '#a8c5da', '#c9dae6', '#8fa8bd', '#6b8ca8'],
  선명: ['#e63946', '#f77f00', '#fcbf49', '#06d6a0', '#118ab2', '#7209b7'],
  단색파랑: ['#0b3d91', '#1e5fbf', '#3d82d9', '#69a5e8', '#9cc6f2', '#cfe3fa'],
  단색회색: ['#2b2b2b', '#4d4d4d', '#6e6e6e', '#909090', '#b3b3b3', '#d6d6d6'],
  대비: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8ab17d'],
}

export const CHART_TYPES: Array<{ key: ChartType; label: string; hint: string }> = [
  { key: 'column', label: '세로 막대', hint: '항목끼리 크기를 견준다 — 가장 무난하다' },
  { key: 'bar', label: '가로 막대', hint: '항목 이름이 길 때' },
  { key: 'line', label: '꺾은선', hint: '시간에 따른 흐름' },
  { key: 'area', label: '영역', hint: '흐름과 함께 크기를 보일 때' },
  { key: 'pie', label: '원', hint: '전체에서 차지하는 몫' },
  { key: 'doughnut', label: '도넛', hint: '가운데를 비운 원 그래프' },
  { key: 'scatter', label: '분산형', hint: '두 값의 관계' },
  { key: 'radar', label: '방사형', hint: '여러 잣대를 한눈에' },
  { key: 'combo', label: '혼합', hint: '막대 + 꺾은선 (두 번째 계열이 선)' },
]

export const DEFAULT_CHART: ChartSpec = {
  type: 'column',
  labels: ['1분기', '2분기', '3분기', '4분기'],
  series: [
    { name: '계열 1', values: [4.3, 2.5, 3.5, 4.5] },
    { name: '계열 2', values: [2.4, 4.4, 1.8, 2.8] },
  ],
  legend: 'bottom',
  grid: true,
  palette: '기본',
  width: 460,
  height: 280,
}

export function chartColors(spec: ChartSpec): string[] {
  const raw = CHART_PALETTES[spec.palette || '기본'] || CHART_PALETTES['기본']
  return raw.map((c) => safeColor(c))
}

/* ── 그리기 ──────────────────────────────────────────── */

interface Box { x: number; y: number; w: number; h: number }

const esc = (s: string | undefined) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** 색은 그림 속성에 그대로 들어가므로 모양을 검사한다 (문서에 심어진 값으로 속성을 비집고 나오지 못하게) */
const safeColor = (c: unknown, fallback = '#4472c4'): string => {
  const v = String(c ?? '').trim()
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d.,\s%]+\)$/i.test(v) || /^[a-z]{3,20}$/i.test(v) ? v : fallback
}
const n2 = (v: number) => (Math.round(v * 100) / 100).toString()

/** 사람이 읽기 좋은 눈금 간격 (1·2·5 × 10ⁿ) */
function niceStep(range: number, want = 5): number {
  if (range <= 0) return 1
  const raw = range / want
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1
  return step * mag
}

function extent(spec: ChartSpec): { min: number; max: number } {
  // 사용자가 축 범위를 못 박았으면 그대로 쓴다 (워드 「축 서식 › 경계」)
  if (spec.axisMin != null && spec.axisMax != null && spec.axisMax > spec.axisMin) {
    return { min: spec.axisMin, max: spec.axisMax }
  }
  const all: number[] = []
  if (spec.stacked && (spec.type === 'column' || spec.type === 'bar' || spec.type === 'area')) {
    for (let i = 0; i < spec.labels.length; i++) {
      let pos = 0, neg = 0
      for (const s of spec.series) {
        const v = s.values[i] ?? 0
        if (v >= 0) pos += v; else neg += v
      }
      all.push(pos, neg)
    }
  } else {
    for (const s of spec.series) for (const v of s.values) all.push(v ?? 0)
  }
  if (!all.length) return { min: 0, max: 1 }
  let min = Math.min(0, ...all)
  let max = Math.max(0, ...all)
  if (min === max) max = min + 1
  const step = niceStep(max - min)
  min = Math.floor(min / step) * step
  max = Math.ceil(max / step) * step
  return { min, max }
}

/** 차트 한 장을 SVG 문자열로 */
export function chartSvg(spec: ChartSpec): string {
  const w = spec.width || 460
  const h = spec.height || 280
  const colors = chartColors(spec)
  const parts: string[] = []
  const showTitle = !!spec.title && spec.titlePos !== 'none'
  const titleH = showTitle ? 26 : 6
  const legendH = spec.legend && spec.legend !== 'none' && spec.legend !== 'right' ? 22 : 0
  const legendW = spec.legend === 'right' ? Math.min(140, w * 0.3) : 0

  parts.push(`<rect width="${w}" height="${h}" fill="#fff"/>`)
  if (showTitle) {
    parts.push(`<text x="${w / 2}" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="#1c1f26">${esc(spec.title)}</text>`)
  }

  const plot: Box = {
    x: spec.mini ? 6 : 46,
    y: titleH + 6,
    w: w - (spec.mini ? 12 : 58) - legendW,
    h: h - titleH - 6 - (spec.mini ? 8 : 28) - legendH,
  }

  const circular = spec.type === 'pie' || spec.type === 'doughnut'
  if (circular) parts.push(pieBody(spec, { x: 8, y: titleH, w: w - 16 - legendW, h: h - titleH - legendH - 8 }, colors))
  else if (spec.type === 'radar') parts.push(radarBody(spec, { x: 8, y: titleH, w: w - 16 - legendW, h: h - titleH - legendH - 8 }, colors))
  else parts.push(cartesianBody(spec, plot, colors))

  if (spec.legend && spec.legend !== 'none') parts.push(legendBody(spec, w, h, colors, legendW))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(spec.title || '차트')}">${parts.join('')}</svg>`
}

/** 막대·선·영역·분산형 — 가로세로 축이 있는 것들 */
function cartesianBody(spec: ChartSpec, box: Box, colors: string[]): string {
  const out: string[] = []
  const { min, max } = extent(spec)
  const step = spec.axisStep && spec.axisStep > 0 ? spec.axisStep : niceStep(max - min)
  const horizontal = spec.type === 'bar'
  const count = spec.labels.length || 1
  const flip = !!spec.axisReverse
  const t = (v: number) => (flip ? max - (v - min) : v) // 축 뒤집기 (워드 「값을 거꾸로」)

  const vx = (v: number) => box.x + ((t(v) - min) / (max - min)) * box.w
  const vy = (v: number) => box.y + box.h - ((t(v) - min) / (max - min)) * box.h

  // 눈금선과 축 값
  for (let v = min; v <= max + 1e-9; v += step) {
    if (horizontal) {
      const x = vx(v)
      if (spec.grid !== false) out.push(`<line x1="${n2(x)}" y1="${box.y}" x2="${n2(x)}" y2="${box.y + box.h}" stroke="#e8ecf1"/>`)
      if (!spec.mini) out.push(`<text x="${n2(x)}" y="${box.y + box.h + 14}" text-anchor="middle" font-size="10" fill="#6b7684">${esc(formatNumber(v, spec.numberFormat))}</text>`)
    } else {
      const y = vy(v)
      if (spec.grid !== false) out.push(`<line x1="${box.x}" y1="${n2(y)}" x2="${box.x + box.w}" y2="${n2(y)}" stroke="#e8ecf1"/>`)
      if (!spec.mini) out.push(`<text x="${box.x - 6}" y="${n2(y + 3)}" text-anchor="end" font-size="10" fill="#6b7684">${esc(formatNumber(v, spec.numberFormat))}</text>`)
    }
  }
  // 보조 눈금선 — 주 눈금 사이를 반으로 가른다 (워드 「보조 눈금선」)
  if (spec.minorGrid && !spec.mini) {
    for (let v = min + step / 2; v < max; v += step) {
      if (horizontal) out.push(`<line x1="${n2(vx(v))}" y1="${box.y}" x2="${n2(vx(v))}" y2="${box.y + box.h}" stroke="#f1f4f8"/>`)
      else out.push(`<line x1="${box.x}" y1="${n2(vy(v))}" x2="${box.x + box.w}" y2="${n2(vy(v))}" stroke="#f1f4f8"/>`)
    }
  }

  // 0 선
  const zero = horizontal ? vx(0) : vy(0)
  out.push(horizontal
    ? `<line x1="${n2(zero)}" y1="${box.y}" x2="${n2(zero)}" y2="${box.y + box.h}" stroke="#b9c2cc"/>`
    : `<line x1="${box.x}" y1="${n2(zero)}" x2="${box.x + box.w}" y2="${n2(zero)}" stroke="#b9c2cc"/>`)

  const bandW = (horizontal ? box.h : box.w) / count
  const label = (i: number) => spec.labels[i] ?? ''

  // 항목 이름
  for (let i = 0; !spec.mini && i < count; i++) {
    const c = (horizontal ? box.y : box.x) + bandW * (i + 0.5)
    out.push(horizontal
      ? `<text x="${box.x - 6}" y="${n2(c + 3)}" text-anchor="end" font-size="10" fill="#3c4551">${esc(label(i))}</text>`
      : `<text x="${n2(c)}" y="${box.y + box.h + 14}" text-anchor="middle" font-size="10" fill="#3c4551">${esc(label(i))}</text>`)
  }

  const bars = spec.series.filter((s) => !(spec.type === 'combo' && s.asLine))
  const lines = spec.type === 'line' || spec.type === 'area' ? spec.series
    : spec.type === 'combo' ? spec.series.filter((s) => s.asLine) : []

  if (spec.type === 'column' || spec.type === 'bar' || spec.type === 'combo') {
    const groupW = bandW * 0.72
    const each = spec.stacked ? groupW : groupW / Math.max(1, bars.length)
    const stackTop: number[] = new Array(count).fill(0)
    bars.forEach((s, si) => {
      const color = safeColor(s.color, colors[si % colors.length])
      for (let i = 0; i < count; i++) {
        const v = s.values[i] ?? 0
        const base = spec.stacked ? stackTop[i] : 0
        if (spec.stacked) stackTop[i] += v
        const c = (horizontal ? box.y : box.x) + bandW * i + (bandW - groupW) / 2 + (spec.stacked ? 0 : each * si)
        if (horizontal) {
          const x1 = vx(base), x2 = vx(base + v)
          out.push(`<rect x="${n2(Math.min(x1, x2))}" y="${n2(c)}" width="${n2(Math.abs(x2 - x1))}" height="${n2(each * 0.86)}" fill="${color}" rx="1"/>`)
          if (spec.valueLabels) {
            const inside = spec.labelPos === 'inside' || spec.labelPos === 'center'
            const lx = spec.labelPos === 'center' ? (x1 + x2) / 2 : inside ? Math.max(x1, x2) - 4 : Math.max(x1, x2) + 4
            out.push(`<text x="${n2(lx)}" y="${n2(c + each * 0.6)}" text-anchor="${inside ? 'end' : 'start'}" font-size="9" fill="${inside ? '#fff' : '#3c4551'}">${esc(formatNumber(v, spec.numberFormat))}</text>`)
          }
        } else {
          const y1 = vy(base), y2 = vy(base + v)
          out.push(`<rect x="${n2(c)}" y="${n2(Math.min(y1, y2))}" width="${n2(each * 0.86)}" height="${n2(Math.abs(y2 - y1))}" fill="${color}" rx="1"/>`)
          if (spec.valueLabels) {
            const inside = spec.labelPos === 'inside' || spec.labelPos === 'center'
            const ly = spec.labelPos === 'center' ? (y1 + y2) / 2 + 3 : inside ? Math.min(y1, y2) + 11 : Math.min(y1, y2) - 3
            out.push(`<text x="${n2(c + each * 0.43)}" y="${n2(ly)}" text-anchor="middle" font-size="9" fill="${inside ? '#fff' : '#3c4551'}">${esc(formatNumber(v, spec.numberFormat))}</text>`)
          }
        }
      }
    })
  }

  if (spec.type === 'scatter') {
    spec.series.forEach((s, si) => {
      const color = safeColor(s.color, colors[si % colors.length])
      for (let i = 0; i < count; i++) {
        const cx = box.x + bandW * (i + 0.5)
        out.push(`<circle cx="${n2(cx)}" cy="${n2(vy(s.values[i] ?? 0))}" r="4" fill="${color}" fill-opacity="0.85"/>`)
      }
    })
  }

  lines.forEach((s, si) => {
    const color = safeColor(s.color, colors[(spec.type === 'combo' ? spec.series.indexOf(s) : si) % colors.length])
    const pts = s.values.slice(0, count).map((v, i) => `${n2(box.x + bandW * (i + 0.5))},${n2(vy(v ?? 0))}`)
    if (!pts.length) return
    if (spec.type === 'area') {
      out.push(`<polygon points="${box.x},${n2(vy(Math.max(min, 0)))} ${pts.join(' ')} ${n2(box.x + bandW * (count - 0.5))},${n2(vy(Math.max(min, 0)))}" fill="${color}" fill-opacity="0.22"/>`)
    }
    const lw = Math.max(0.5, Math.min(6, s.lineWidth ?? 2.2))
    const dash = s.dashed ? ` stroke-dasharray="${n2(lw * 3)} ${n2(lw * 2)}"` : ''
    out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="${n2(lw)}"${dash} stroke-linejoin="round" stroke-linecap="round"/>`)
    s.values.slice(0, count).forEach((v, i) => {
      const mx = box.x + bandW * (i + 0.5)
      const my = vy(v ?? 0)
      const marker = s.marker ?? 'circle'
      if (marker === 'square') out.push(`<rect x="${n2(mx - 3)}" y="${n2(my - 3)}" width="6" height="6" fill="#fff" stroke="${color}" stroke-width="2"/>`)
      else if (marker === 'diamond') out.push(`<polygon points="${n2(mx)},${n2(my - 4)} ${n2(mx + 4)},${n2(my)} ${n2(mx)},${n2(my + 4)} ${n2(mx - 4)},${n2(my)}" fill="#fff" stroke="${color}" stroke-width="2"/>`)
      else if (marker !== 'none') out.push(`<circle cx="${n2(mx)}" cy="${n2(my)}" r="3" fill="#fff" stroke="${color}" stroke-width="2"/>`)
      if (spec.valueLabels) out.push(`<text x="${n2(box.x + bandW * (i + 0.5))}" y="${n2(vy(v ?? 0) - 8)}" text-anchor="middle" font-size="9" fill="#3c4551">${esc(formatNumber(v ?? 0, spec.numberFormat))}</text>`)
    })
  })

  // 추세선 (워드 「추세선 추가」)
  if (spec.trend && spec.trend !== 'none' && spec.series[0] && !spec.mini) {
    const values = spec.series[0].values.slice(0, count).map((v) => v ?? 0)
    const color = '#6b7684'
    if (spec.trend === 'linear' && values.length >= 2) {
      const n = values.length
      const sumX = values.reduce((a, _v, i) => a + i, 0)
      const sumY = values.reduce((a, v) => a + v, 0)
      const sumXY = values.reduce((a, v, i) => a + i * v, 0)
      const sumXX = values.reduce((a, _v, i) => a + i * i, 0)
      const slope = (n * sumXY - sumX * sumY) / Math.max(1e-9, n * sumXX - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n
      const x1 = box.x + bandW * 0.5, x2 = box.x + bandW * (n - 0.5)
      out.push(`<line x1="${n2(x1)}" y1="${n2(vy(intercept))}" x2="${n2(x2)}" y2="${n2(vy(intercept + slope * (n - 1)))}" stroke="${color}" stroke-width="1.6" stroke-dasharray="6 4"/>`)
    } else if (spec.trend === 'average') {
      const pts = values.map((_v, i) => {
        const near = [values[i - 1], values[i], values[i + 1]].filter((x) => typeof x === 'number') as number[]
        const avg = near.reduce((a, b) => a + b, 0) / near.length
        return `${n2(box.x + bandW * (i + 0.5))},${n2(vy(avg))}`
      })
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="6 4"/>`)
    }
  }

  if (spec.axisY) out.push(`<text x="12" y="${n2(box.y + box.h / 2)}" text-anchor="middle" font-size="10" fill="#6b7684" transform="rotate(-90 12 ${n2(box.y + box.h / 2)})">${esc(spec.axisY)}</text>`)
  if (spec.axisX) out.push(`<text x="${n2(box.x + box.w / 2)}" y="${n2(box.y + box.h + 26)}" text-anchor="middle" font-size="10" fill="#6b7684">${esc(spec.axisX)}</text>`)
  return out.join('')
}

/** 원·도넛 — 첫 계열만 쓴다 (워드와 같다) */
function pieBody(spec: ChartSpec, box: Box, colors: string[]): string {
  const values = (spec.series[0]?.values || []).map((v) => Math.abs(v ?? 0))
  const total = values.reduce((a, b) => a + b, 0) || 1
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const r = Math.max(20, Math.min(box.w, box.h) / 2 - 12)
  const inner = spec.type === 'doughnut' ? r * 0.55 : 0
  const out: string[] = []
  let angle = -Math.PI / 2
  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2
    const color = safeColor(values.length === 1 ? spec.series[0]?.color : undefined, colors[i % colors.length])
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep)
    const big = sweep > Math.PI ? 1 : 0
    if (inner > 0) {
      const ix1 = cx + inner * Math.cos(angle + sweep), iy1 = cy + inner * Math.sin(angle + sweep)
      const ix2 = cx + inner * Math.cos(angle), iy2 = cy + inner * Math.sin(angle)
      out.push(`<path d="M${n2(x1)},${n2(y1)} A${n2(r)},${n2(r)} 0 ${big} 1 ${n2(x2)},${n2(y2)} L${n2(ix1)},${n2(iy1)} A${n2(inner)},${n2(inner)} 0 ${big} 0 ${n2(ix2)},${n2(iy2)} Z" fill="${color}"/>`)
    } else {
      out.push(`<path d="M${n2(cx)},${n2(cy)} L${n2(x1)},${n2(y1)} A${n2(r)},${n2(r)} 0 ${big} 1 ${n2(x2)},${n2(y2)} Z" fill="${color}"/>`)
    }
    if (spec.valueLabels) {
      const mid = angle + sweep / 2
      const lr = inner > 0 ? (r + inner) / 2 : r * 0.65
      out.push(`<text x="${n2(cx + lr * Math.cos(mid))}" y="${n2(cy + lr * Math.sin(mid) + 3)}" text-anchor="middle" font-size="10" fill="#fff" font-weight="600">${n2(Math.round((v / total) * 1000) / 10)}%</text>`)
    }
    angle += sweep
  })
  return out.join('')
}

/** 방사형 — 잣대마다 축이 하나씩 */
function radarBody(spec: ChartSpec, box: Box, colors: string[]): string {
  const out: string[] = []
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const r = Math.max(20, Math.min(box.w, box.h) / 2 - 22)
  const axes = spec.labels.length || 1
  const { max } = extent(spec)
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / axes) * Math.PI * 2
    const rr = (Math.max(0, v) / (max || 1)) * r
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const
  }
  for (let ring = 1; ring <= 4; ring++) {
    const pts = Array.from({ length: axes }, (_, i) => at(i, (max * ring) / 4).map(n2).join(',')).join(' ')
    out.push(`<polygon points="${pts}" fill="none" stroke="#e8ecf1"/>`)
  }
  for (let i = 0; i < axes; i++) {
    const [x, y] = at(i, max)
    out.push(`<line x1="${n2(cx)}" y1="${n2(cy)}" x2="${n2(x)}" y2="${n2(y)}" stroke="#e8ecf1"/>`)
    if (!spec.mini) {
      const [lx, ly] = at(i, max * 1.16)
      out.push(`<text x="${n2(lx)}" y="${n2(ly + 3)}" text-anchor="middle" font-size="10" fill="#3c4551">${esc(spec.labels[i] ?? '')}</text>`)
    }
  }
  spec.series.forEach((s, si) => {
    const color = safeColor(s.color, colors[si % colors.length])
    const pts = Array.from({ length: axes }, (_, i) => at(i, s.values[i] ?? 0).map(n2).join(',')).join(' ')
    out.push(`<polygon points="${pts}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2"/>`)
  })
  return out.join('')
}

function legendBody(spec: ChartSpec, w: number, h: number, colors: string[], legendW: number): string {
  const names = spec.type === 'pie' || spec.type === 'doughnut'
    ? spec.labels
    : spec.series.map((s) => s.name)
  const out: string[] = []
  if (spec.legend === 'right') {
    const x = w - legendW + 6
    names.forEach((name, i) => {
      const y = 26 + i * 18
      out.push(`<rect x="${x}" y="${y - 8}" width="10" height="10" rx="2" fill="${colors[i % colors.length]}"/>`)
      out.push(`<text x="${x + 15}" y="${y + 1}" font-size="10" fill="#3c4551">${esc(name)}</text>`)
    })
    return out.join('')
  }
  const y = spec.legend === 'top' ? 14 : h - 8
  const itemW = Math.min(120, w / Math.max(1, names.length))
  const startX = (w - itemW * names.length) / 2
  names.forEach((name, i) => {
    const x = startX + itemW * i
    out.push(`<rect x="${n2(x)}" y="${n2(y - 8)}" width="10" height="10" rx="2" fill="${colors[i % colors.length]}"/>`)
    out.push(`<text x="${n2(x + 15)}" y="${n2(y + 1)}" font-size="10" fill="#3c4551">${esc(name)}</text>`)
  })
  return out.join('')
}

/* ── 데이터 다루기 ───────────────────────────────────── */

/** 표(2차원 글자)를 차트 데이터로 — 첫 줄은 계열 이름, 첫 칸은 항목 이름 */
export function specFromGrid(grid: string[][], base: ChartSpec = DEFAULT_CHART): ChartSpec {
  const rows = grid.filter((r) => r.some((c) => (c ?? '').trim() !== ''))
  if (rows.length < 2) return { ...base }
  const head = rows[0]
  const labels = rows.slice(1).map((r) => (r[0] ?? '').trim())
  const series: ChartSeries[] = []
  for (let c = 1; c < head.length; c++) {
    series.push({
      name: (head[c] ?? `계열 ${c}`).trim() || `계열 ${c}`,
      values: rows.slice(1).map((r) => toNumber(r[c])),
    })
  }
  return { ...base, labels, series: series.length ? series : base.series }
}

/** 차트 데이터를 표(2차원 글자)로 — 편집 창이 쓴다 */
export function gridFromSpec(spec: ChartSpec): string[][] {
  const head = ['', ...spec.series.map((s) => s.name)]
  const rows = spec.labels.map((label, i) => [label, ...spec.series.map((s) => String(s.values[i] ?? 0))])
  return [head, ...rows]
}

export function toNumber(raw: unknown): number {
  const v = parseFloat(String(raw ?? '').replace(/[,\s%₩$]/g, ''))
  return Number.isFinite(v) ? v : 0
}

/** CSV·표 붙여넣기 글을 2차원 표로 */
export function parseGridText(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim()))
}
