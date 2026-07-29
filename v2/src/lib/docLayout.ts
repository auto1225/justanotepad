/**
 * 쪽 배치 — 워드 「레이아웃」 탭에서 우리에게 없던 것들.
 *
 *   텍스트 방향(세로쓰기) · 줄 번호 · 하이픈 · 원고지
 *
 * 모두 문서 한 벌에 딸린 설정이라 저장본에 함께 담기고, 다시 열면 그대로 살아난다.
 */

export type TextDirection = 'horizontal' | 'vertical'
export type LineNumberMode = 'none' | 'continuous' | 'page'
export type HyphenMode = 'none' | 'auto'

export interface ManuscriptGrid {
  on: boolean
  /** 한 줄에 몇 칸 (원고지 200자면 20칸 × 10줄) */
  cols: number
  rows: number
  color: string
}

export interface DocLayout {
  textDirection: TextDirection
  lineNumbers: LineNumberMode
  /** 줄 번호를 몇 줄마다 보일까 (1이면 모든 줄) */
  lineNumberStep: number
  hyphen: HyphenMode
  grid: ManuscriptGrid
}

export const DEFAULT_LAYOUT: DocLayout = {
  textDirection: 'horizontal',
  lineNumbers: 'none',
  lineNumberStep: 1,
  hyphen: 'none',
  grid: { on: false, cols: 20, rows: 10, color: '#e5b8b8' },
}

export const LINE_NUMBER_MODES: Array<{ key: LineNumberMode; label: string; hint: string }> = [
  { key: 'none', label: '없음', hint: '줄 번호를 붙이지 않는다' },
  { key: 'continuous', label: '연속', hint: '문서 처음부터 이어서 센다' },
  { key: 'page', label: '쪽마다 다시 시작', hint: '새 쪽마다 1부터' },
]

export const MANUSCRIPT_PRESETS: Array<{ key: string; label: string; cols: number; rows: number }> = [
  { key: '200', label: '200자 (20×10)', cols: 20, rows: 10 },
  { key: '400', label: '400자 (20×20)', cols: 20, rows: 20 },
  { key: '100', label: '100자 (10×10)', cols: 10, rows: 10 },
  { key: '600', label: '600자 (25×24)', cols: 25, rows: 24 },
]

/** 고른 배치를 화면에 입힌다 (인쇄도 같은 규칙을 쓴다) */
export function applyLayout(layout: DocLayout, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-jan-text-dir', layout.textDirection)
  root.setAttribute('data-jan-line-numbers', layout.lineNumbers)
  root.setAttribute('data-jan-hyphen', layout.hyphen)
  root.setAttribute('data-jan-grid', layout.grid.on ? 'on' : 'off')
  root.style.setProperty('--jan-line-number-step', String(Math.max(1, layout.lineNumberStep)))
  root.style.setProperty('--jan-grid-cols', String(layout.grid.cols))
  root.style.setProperty('--jan-grid-rows', String(layout.grid.rows))
  root.style.setProperty('--jan-grid-color', /^#[0-9a-f]{3,8}$/i.test(layout.grid.color) ? layout.grid.color : '#e5b8b8')
}

/** 저장본에서 온 값 다듬기 */
export function normalizeLayout(value: unknown, fallback: DocLayout = DEFAULT_LAYOUT): DocLayout {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const grid = (raw.grid && typeof raw.grid === 'object' ? raw.grid : {}) as Record<string, unknown>
  const int = (v: unknown, def: number, min: number, max: number) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
  }
  return {
    textDirection: raw.textDirection === 'vertical' ? 'vertical' : 'horizontal',
    lineNumbers: raw.lineNumbers === 'continuous' || raw.lineNumbers === 'page' ? raw.lineNumbers : 'none',
    lineNumberStep: int(raw.lineNumberStep, fallback.lineNumberStep, 1, 20),
    hyphen: raw.hyphen === 'auto' ? 'auto' : 'none',
    grid: {
      on: typeof grid.on === 'boolean' ? grid.on : fallback.grid.on,
      cols: int(grid.cols, fallback.grid.cols, 5, 40),
      rows: int(grid.rows, fallback.grid.rows, 5, 40),
      color: /^#[0-9a-f]{3,8}$/i.test(String(grid.color)) ? String(grid.color) : fallback.grid.color,
    },
  }
}
