/**
 * 표 셀 수식 — 워드의 「레이아웃 ▸ 수식(fx)」과 같은 문법.
 *
 *   =SUM(ABOVE)        위쪽 칸을 모두 더한다
 *   =AVERAGE(LEFT)     왼쪽 칸의 평균
 *   =B2*C2             셀을 직접 가리킨다 (엑셀식 A1 주소)
 *   =SUM(A1:A5)/2      범위와 사칙연산을 섞어 쓴다
 *   =IF(SUM(ABOVE)>100, 1, 0)
 *
 * 워드와 같은 점: 방향 낱말(ABOVE·BELOW·LEFT·RIGHT), A1 주소, 함수 이름, 숫자 형식.
 * 워드와 다른 점: 값이 바뀌면 스스로 다시 계산한다 (워드는 F9 를 눌러야 한다).
 */

export type CellGrid = string[][]

export interface FormulaContext {
  /** 표 전체의 칸 글자 (병합은 왼쪽 위 칸에만 값이 있다) */
  grid: CellGrid
  /** 이 수식이 놓인 칸 (0부터) */
  row: number
  col: number
}

/** 워드가 지원하는 함수들 */
const FUNCTIONS = [
  'ABS', 'AND', 'AVERAGE', 'COUNT', 'DEFINED', 'FALSE', 'IF', 'INT', 'MAX',
  'MIN', 'MOD', 'NOT', 'OR', 'PRODUCT', 'ROUND', 'SIGN', 'SUM', 'TRUE',
] as const

export const FORMULA_FUNCTIONS: ReadonlyArray<{ name: string; hint: string }> = [
  { name: 'SUM', hint: '합계 — =SUM(ABOVE)' },
  { name: 'AVERAGE', hint: '평균 — =AVERAGE(LEFT)' },
  { name: 'COUNT', hint: '숫자가 든 칸 수' },
  { name: 'MAX', hint: '가장 큰 값' },
  { name: 'MIN', hint: '가장 작은 값' },
  { name: 'PRODUCT', hint: '곱' },
  { name: 'ROUND', hint: '반올림 — =ROUND(A1, 2)' },
  { name: 'INT', hint: '소수점 버림' },
  { name: 'ABS', hint: '절댓값' },
  { name: 'MOD', hint: '나머지 — =MOD(A1, 3)' },
  { name: 'SIGN', hint: '부호 (-1 · 0 · 1)' },
  { name: 'IF', hint: '조건 — =IF(A1>10, 1, 0)' },
  { name: 'AND', hint: '모두 참인가' },
  { name: 'OR', hint: '하나라도 참인가' },
  { name: 'NOT', hint: '참·거짓 뒤집기' },
  { name: 'DEFINED', hint: '값이 있는가' },
  { name: 'TRUE', hint: '참 (1)' },
  { name: 'FALSE', hint: '거짓 (0)' },
]

/** 워드의 「번호 형식」과 같은 뜻으로 쓰는 표시 형식 */
export const NUMBER_FORMATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '그대로' },
  { value: '#,##0', label: '1,234' },
  { value: '#,##0.0', label: '1,234.5' },
  { value: '#,##0.00', label: '1,234.56' },
  { value: '0.00', label: '1234.56' },
  { value: '0%', label: '백분율 (12%)' },
  { value: '0.0%', label: '백분율 (12.3%)' },
  { value: '₩#,##0', label: '원화 (₩1,234)' },
]

/* ── 숫자 읽기 ── */

/** 칸의 글자에서 숫자를 뽑는다 — ₩1,200 · 12.5% · (5) 같은 표기를 모두 받는다 */
export function cellNumber(text: string): number | null {
  const raw = (text || '').trim()
  if (!raw) return null
  const negative = /^\(.*\)$/.test(raw)
  let body = negative ? raw.slice(1, -1) : raw
  const percent = /%\s*$/.test(body)
  body = body.replace(/[₩$€£¥원,\s%]/g, '')
  if (!body || !/^[+-]?\d*\.?\d+$/.test(body)) return null
  let value = Number(body)
  if (!Number.isFinite(value)) return null
  if (percent) value /= 100
  return negative ? -value : value
}

/* ── A1 주소 ── */

/** 'A' → 0, 'B' → 1, 'AA' → 26 */
export function columnIndexFromLetters(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** 0 → 'A', 26 → 'AA' */
export function columnLetters(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** 'B3' → { row: 2, col: 1 } (없는 주소면 null) */
function parseAddress(ref: string): { row: number; col: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
  if (!m) return null
  const row = Number(m[2]) - 1
  if (row < 0) return null
  return { row, col: columnIndexFromLetters(m[1]) }
}

/* ── 토큰 ── */

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'name'; v: string }
  | { t: 'ref'; v: string }
  | { t: '('; }
  | { t: ')'; }
  | { t: ','; }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '(') { out.push({ t: '(' }); i++; continue }
    if (ch === ')') { out.push({ t: ')' }); i++; continue }
    if (ch === ',' || ch === ';') { out.push({ t: ',' }); i++; continue }
    if (/[0-9.]/.test(ch)) {
      const m = /^\d*\.?\d+/.exec(src.slice(i))
      if (!m) throw new Error('숫자를 읽을 수 없습니다')
      out.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      const m = /^[A-Za-z]+\d*(:[A-Za-z]+\d+)?/.exec(src.slice(i))!
      const word = m[0]
      i += word.length
      // A1 · A1:B3 처럼 숫자가 붙으면 셀 주소, 아니면 함수·방향 낱말
      out.push(/\d/.test(word) ? { t: 'ref', v: word } : { t: 'name', v: word.toUpperCase() })
      continue
    }
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') { out.push({ t: 'op', v: two }); i += 2; continue }
    if ('+-*/^%<>='.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue }
    throw new Error(`알 수 없는 글자: ${ch}`)
  }
  return out
}

/* ── 값 모으기 ── */

function readGrid(ctx: FormulaContext, row: number, col: number): number | null {
  const line = ctx.grid[row]
  if (!line) return null
  return cellNumber(line[col] ?? '')
}

/** 방향 낱말이 가리키는 칸들 — 워드처럼 빈 칸이나 글자 칸을 만나면 거기서 멈춘다 */
function directionValues(ctx: FormulaContext, word: string): number[] {
  const out: number[] = []
  const push = (v: number | null) => { if (v !== null) out.push(v) }
  const stopAt = (v: number | null) => v === null
  if (word === 'ABOVE') {
    for (let r = ctx.row - 1; r >= 0; r--) { const v = readGrid(ctx, r, ctx.col); if (stopAt(v)) break; push(v) }
  } else if (word === 'BELOW') {
    for (let r = ctx.row + 1; r < ctx.grid.length; r++) { const v = readGrid(ctx, r, ctx.col); if (stopAt(v)) break; push(v) }
  } else if (word === 'LEFT') {
    for (let c = ctx.col - 1; c >= 0; c--) { const v = readGrid(ctx, ctx.row, c); if (stopAt(v)) break; push(v) }
  } else if (word === 'RIGHT') {
    const line = ctx.grid[ctx.row] || []
    for (let c = ctx.col + 1; c < line.length; c++) { const v = readGrid(ctx, ctx.row, c); if (stopAt(v)) break; push(v) }
  }
  return out
}

/** 'A1' · 'A1:B3' 가 가리키는 값들 */
function refValues(ctx: FormulaContext, ref: string): number[] {
  const [a, b] = ref.split(':')
  const from = parseAddress(a)
  if (!from) return []
  if (!b) {
    const v = readGrid(ctx, from.row, from.col)
    return v === null ? [] : [v]
  }
  const to = parseAddress(b)
  if (!to) return []
  const out: number[] = []
  for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
    for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
      const v = readGrid(ctx, r, c)
      if (v !== null) out.push(v)
    }
  }
  return out
}

/* ── 계산 ── */

interface Parser {
  tokens: Token[]
  i: number
  ctx: FormulaContext
}

function peek(p: Parser): Token | undefined { return p.tokens[p.i] }
function take(p: Parser): Token | undefined { return p.tokens[p.i++] }

/** 인자 하나를 값의 묶음으로 읽는다 (SUM(ABOVE) 처럼 여러 칸일 수 있다) */
function parseArgValues(p: Parser): number[] {
  const tk = peek(p)
  if (tk?.t === 'name' && ['ABOVE', 'BELOW', 'LEFT', 'RIGHT'].includes(tk.v)) {
    p.i++
    return directionValues(p.ctx, tk.v)
  }
  if (tk?.t === 'ref' && tk.v.includes(':')) {
    p.i++
    return refValues(p.ctx, tk.v)
  }
  return [parseExpression(p)]
}

function callFunction(p: Parser, name: string): number {
  // 인자 없는 함수
  if (name === 'TRUE') { skipEmptyArgs(p); return 1 }
  if (name === 'FALSE') { skipEmptyArgs(p); return 0 }

  const args: number[][] = []
  if (peek(p)?.t === '(') {
    p.i++
    if (peek(p)?.t === ')') p.i++
    else {
      for (;;) {
        args.push(parseArgValues(p))
        const next = take(p)
        if (next?.t === ',') continue
        if (next?.t === ')') break
        throw new Error(`${name}: 괄호가 맞지 않습니다`)
      }
    }
  }
  const flat = args.flat()
  const first = flat[0] ?? 0
  switch (name) {
    case 'SUM': return flat.reduce((a, b) => a + b, 0)
    case 'PRODUCT': return flat.length ? flat.reduce((a, b) => a * b, 1) : 0
    case 'AVERAGE': return flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0
    case 'COUNT': return flat.length
    case 'MAX': return flat.length ? Math.max(...flat) : 0
    case 'MIN': return flat.length ? Math.min(...flat) : 0
    case 'ABS': return Math.abs(first)
    case 'INT': return Math.trunc(first)
    case 'SIGN': return Math.sign(first)
    case 'ROUND': {
      const digits = args[1]?.[0] ?? 0
      const f = 10 ** digits
      return Math.round(first * f) / f
    }
    case 'MOD': return first % (args[1]?.[0] ?? 1)
    case 'IF': return first ? (args[1]?.[0] ?? 0) : (args[2]?.[0] ?? 0)
    case 'AND': return flat.every((v) => v !== 0) ? 1 : 0
    case 'OR': return flat.some((v) => v !== 0) ? 1 : 0
    case 'NOT': return first === 0 ? 1 : 0
    case 'DEFINED': return flat.length ? 1 : 0
    default: throw new Error(`모르는 함수: ${name}`)
  }
}

function skipEmptyArgs(p: Parser) {
  if (peek(p)?.t === '(') { p.i++; if (peek(p)?.t === ')') p.i++ }
}

function parsePrimary(p: Parser): number {
  const tk = take(p)
  if (!tk) throw new Error('수식이 끝나지 않았습니다')
  if (tk.t === 'num') return tk.v
  if (tk.t === '(') {
    const v = parseExpression(p)
    if (take(p)?.t !== ')') throw new Error('괄호가 맞지 않습니다')
    return v
  }
  if (tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
    const v = parsePrimary(p)
    return tk.v === '-' ? -v : v
  }
  if (tk.t === 'ref') {
    const values = refValues(p.ctx, tk.v)
    return tk.v.includes(':') ? values.reduce((a, b) => a + b, 0) : (values[0] ?? 0)
  }
  if (tk.t === 'name') {
    if (['ABOVE', 'BELOW', 'LEFT', 'RIGHT'].includes(tk.v)) {
      return directionValues(p.ctx, tk.v).reduce((a, b) => a + b, 0)
    }
    if ((FUNCTIONS as readonly string[]).includes(tk.v)) return callFunction(p, tk.v)
    throw new Error(`모르는 이름: ${tk.v}`)
  }
  throw new Error('수식을 읽을 수 없습니다')
}

function parsePower(p: Parser): number {
  const base = parsePrimary(p)
  const tk = peek(p)
  if (tk?.t === 'op' && tk.v === '^') { p.i++; return base ** parsePower(p) }
  return base
}

function parseTerm(p: Parser): number {
  let v = parsePower(p)
  for (;;) {
    const tk = peek(p)
    if (tk?.t !== 'op' || !['*', '/', '%'].includes(tk.v)) return v
    p.i++
    const rhs = parsePower(p)
    if (tk.v === '*') v *= rhs
    else if (tk.v === '/') v = rhs === 0 ? 0 : v / rhs
    else v %= rhs
  }
}

function parseSum(p: Parser): number {
  let v = parseTerm(p)
  for (;;) {
    const tk = peek(p)
    if (tk?.t !== 'op' || !['+', '-'].includes(tk.v)) return v
    p.i++
    const rhs = parseTerm(p)
    v = tk.v === '+' ? v + rhs : v - rhs
  }
}

function parseExpression(p: Parser): number {
  let v = parseSum(p)
  for (;;) {
    const tk = peek(p)
    if (tk?.t !== 'op' || !['<', '>', '<=', '>=', '=', '<>', '!='].includes(tk.v)) return v
    p.i++
    const rhs = parseSum(p)
    switch (tk.v) {
      case '<': v = v < rhs ? 1 : 0; break
      case '>': v = v > rhs ? 1 : 0; break
      case '<=': v = v <= rhs ? 1 : 0; break
      case '>=': v = v >= rhs ? 1 : 0; break
      case '=': v = v === rhs ? 1 : 0; break
      default: v = v !== rhs ? 1 : 0
    }
  }
}

/** 수식을 계산한다. 못 읽으면 null (칸에는 원래 글자를 남긴다) */
export function evaluateFormula(formula: string, ctx: FormulaContext): number | null {
  const src = (formula || '').trim().replace(/^=/, '')
  if (!src) return null
  try {
    const p: Parser = { tokens: tokenize(src), i: 0, ctx }
    const value = parseExpression(p)
    if (p.i < p.tokens.length) return null // 남은 토큰이 있으면 잘못 쓴 수식이다
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/* ── 표시 형식 ── */

/** 워드의 번호 형식과 같은 결과를 낸다 (#,##0.00 · 0% · ₩#,##0) */
export function formatNumber(value: number, format?: string | null): string {
  const fmt = (format || '').trim()
  if (!fmt) {
    // 그대로 — 지저분한 부동소수점 꼬리만 정리한다
    return String(Math.round(value * 1e10) / 1e10)
  }
  const percent = fmt.includes('%')
  const shown = percent ? value * 100 : value
  const decimals = (/\.(0+)/.exec(fmt)?.[1].length) ?? 0
  const grouped = fmt.includes(',')
  const prefix = /^[^#0]*/.exec(fmt)?.[0].replace(/[%]/g, '') ?? ''
  const fixed = Math.abs(shown).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const withCommas = grouped ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : intPart
  const sign = shown < 0 ? '-' : ''
  return `${sign}${prefix}${withCommas}${decPart ? '.' + decPart : ''}${percent ? '%' : ''}`
}
