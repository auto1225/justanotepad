import { create } from 'zustand'
import { DEFAULT_DESIGN, applyDesign } from '../lib/docDesign'
import { DEFAULT_LAYOUT, applyLayout, normalizeLayout } from '../lib/docLayout'
import { DEFAULT_STYLE_SHEET, applyStyleSheet, normalizeStyleSheet, sameStyleSheet } from '../lib/docStyles'
import type { DocLayout } from '../lib/docLayout'
import type { DocDesign } from '../lib/docDesign'
import type { NamedStyle, StyleSheet } from '../lib/docStyles'
import { persist } from 'zustand/middleware'

export type PaperStyle = 'lined' | 'grid' | 'dot' | 'blank' | 'music' | 'cornell'
export type PageSizePreset = 'A4' | 'A3' | 'B4' | 'A5' | 'B5' | 'Letter' | 'Legal' | 'Tabloid' | 'Executive' | 'A6' | 'SinGuk' | 'Book46' | 'custom'
export type PageOrientation = 'portrait' | 'landscape'
export type PageColumnCount = 1 | 2 | 3
export type ViewLayoutMode = 'print' | 'draft'
export type PageNumberFormat = 'arabic' | 'dash' | 'lowerRoman' | 'upperRoman'
export type GutterPosition = 'left' | 'top'
export const DEFAULT_RUNNING_FOOTER = 'Page {page} / {total}'
export const ZOOM_MIN = 0.35
export const ZOOM_MAX = 2
export interface PageMarginsMm {
  top: number
  right: number
  bottom: number
  left: number
}

export interface MemoPageSettings {
  paperStyle: PaperStyle
  pageSize: PageSizePreset
  pageOrientation: PageOrientation
  pageMarginMm: number
  pageMarginsMm: PageMarginsMm
  pageColumnCount: PageColumnCount
  runningHeader: string
  runningFooter: string
  /** 사용자 지정 용지 (pageSize==='custom' 일 때 사용) */
  customPageWidthMm: number
  customPageHeightMm: number
  /** 제본 여백 — 해당 변 여백에 가산 */
  gutterMm: number
  gutterPosition: GutterPosition
  /** 페이지 번호 */
  pageNumberFormat: PageNumberFormat
  pageNumberStart: number
  /** 첫 페이지 머리글·꼬리말 표시 안 함 (표지용) */
  firstPageRunningOff: boolean
  /** 워터마크 텍스트 (빈 문자열 = 끔) */
  watermarkText: string
  /** 문서 디자인 한 벌 — 워드 「디자인」 탭 (문서 서식·테마 색·글꼴·간격·효과·쪽 색·쪽 테두리) */
  design: DocDesign
  /** 쪽 배치 — 워드 「레이아웃」 탭 (텍스트 방향·줄 번호·하이픈·원고지) */
  layout: DocLayout
  /**
   * 이름 있는 스타일 한 벌 — 워드 「스타일」 창.
   * 문단에는 이름표만 붙고 서식 값은 여기 한 곳에 산다. 그래서 문서와 함께 다녀야 한다:
   * 정의가 없으면 표만 붙은 채 아무 서식도 안 붙은 문단이 남는다.
   */
  styles: StyleSheet
}

export const DEFAULT_MEMO_PAGE_SETTINGS: MemoPageSettings = {
  paperStyle: 'lined',
  pageSize: 'A4',
  pageOrientation: 'portrait',
  pageMarginMm: 20,
  pageMarginsMm: { top: 20, right: 20, bottom: 20, left: 20 },
  pageColumnCount: 1,
  runningHeader: '',
  runningFooter: DEFAULT_RUNNING_FOOTER,
  customPageWidthMm: 210,
  customPageHeightMm: 297,
  gutterMm: 0,
  gutterPosition: 'left',
  pageNumberFormat: 'arabic',
  pageNumberStart: 1,
  firstPageRunningOff: false,
  watermarkText: '',
  design: DEFAULT_DESIGN,
  layout: DEFAULT_LAYOUT,
  styles: DEFAULT_STYLE_SHEET,
}

/** 워드식 이름 있는 여백 프리셋 */
export const MARGIN_NAMED_PRESETS: ReadonlyArray<{ key: string; label: string; margins: PageMarginsMm }> = [
  { key: 'narrow', label: '좁게', margins: { top: 13, right: 13, bottom: 13, left: 13 } },
  { key: 'normal', label: '기본', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
  { key: 'moderate', label: '보통', margins: { top: 25, right: 19, bottom: 25, left: 19 } },
  { key: 'wide', label: '넓게', margins: { top: 25, right: 30, bottom: 25, left: 30 } },
]

export const PAPER_STYLES: Array<{ value: PaperStyle; label: string; description: string }> = [
  { value: 'lined', label: '줄노트 (기본)', description: 'v1 기본 노트 배경' },
  { value: 'grid', label: '모눈종이', description: '20px 격자' },
  { value: 'dot', label: '점격자', description: '점으로 된 격자' },
  { value: 'blank', label: '무지', description: '빈 종이' },
  { value: 'music', label: '오선지', description: '악보용 줄' },
  { value: 'cornell', label: '코넬 노트', description: '좌측 큐 영역 + 줄노트' },
]

export const PAGE_PRESETS: Record<Exclude<PageSizePreset, 'custom'>, { label: string; widthMm: number; heightMm: number }> = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  A3: { label: 'A3', widthMm: 297, heightMm: 420 },
  B4: { label: 'B4', widthMm: 250, heightMm: 353 },
  A5: { label: 'A5', widthMm: 148, heightMm: 210 },
  A6: { label: 'A6', widthMm: 105, heightMm: 148 },
  B5: { label: 'B5', widthMm: 176, heightMm: 250 },
  Letter: { label: 'Letter', widthMm: 216, heightMm: 279 },
  Legal: { label: 'Legal', widthMm: 216, heightMm: 356 },
  Tabloid: { label: 'Tabloid', widthMm: 279, heightMm: 432 },
  Executive: { label: 'Executive', widthMm: 184, heightMm: 267 },
  SinGuk: { label: '신국판', widthMm: 152, heightMm: 225 },
  Book46: { label: '46배판', widthMm: 188, heightMm: 257 },
}

export function clampCustomPageMm(value: unknown, fallback: number): number {
  const next = Number(value)
  const base = Number.isFinite(next) ? next : fallback
  return Math.max(50, Math.min(1000, Math.round(base)))
}

export interface CustomPageMm { widthMm: number; heightMm: number }

export function pageDimensions(size: PageSizePreset, orientation: PageOrientation, custom?: CustomPageMm) {
  const portrait = size === 'custom'
    ? {
        widthMm: clampCustomPageMm(custom?.widthMm, 210),
        heightMm: clampCustomPageMm(custom?.heightMm, 297),
      }
    : (() => { const p = PAGE_PRESETS[size] || PAGE_PRESETS.A4; return { widthMm: p.widthMm, heightMm: p.heightMm } })()
  return orientation === 'landscape'
    ? { widthMm: portrait.heightMm, heightMm: portrait.widthMm }
    : portrait
}

export function pageDimensionsPx(size: PageSizePreset, orientation: PageOrientation, custom?: CustomPageMm) {
  const { widthMm, heightMm } = pageDimensions(size, orientation, custom)
  const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4)
  return { pageWidth: mmToPx(widthMm), pageHeight: mmToPx(heightMm) }
}

/** 제본 여백(거터)을 해당 변에 가산한 실효 여백 */
export function effectiveMarginsMm(margins: PageMarginsMm, gutterMm: number, gutterPosition: GutterPosition): PageMarginsMm {
  const g = Math.max(0, Math.min(30, Math.round(Number(gutterMm) || 0)))
  if (g === 0) return margins
  return gutterPosition === 'top'
    ? { ...margins, top: margins.top + g }
    : { ...margins, left: margins.left + g }
}

const PAGE_NUMBER_FORMATS: ReadonlyArray<PageNumberFormat> = ['arabic', 'dash', 'lowerRoman', 'upperRoman']

export function normalizePageNumberFormat(value: unknown): PageNumberFormat {
  return PAGE_NUMBER_FORMATS.includes(value as PageNumberFormat) ? (value as PageNumberFormat) : 'arabic'
}

export function normalizePageNumberStart(value: unknown): number {
  const next = Number(value)
  if (!Number.isFinite(next)) return 1
  return Math.max(1, Math.min(9999, Math.round(next)))
}

function toRoman(num: number): string {
  const table: Array<[number, string]> = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
  let n = Math.max(1, Math.round(num))
  let out = ''
  for (const [v, s] of table) { while (n >= v) { out += s; n -= v } }
  return out
}

/** 페이지 번호를 지정 형식으로 */
export function formatPageNumber(page: number, format: PageNumberFormat): string {
  const n = Math.max(1, Math.round(page))
  switch (format) {
    case 'dash': return `- ${n} -`
    case 'lowerRoman': return toRoman(n)
    case 'upperRoman': return toRoman(n).toUpperCase()
    default: return String(n)
  }
}

export function normalizePageColumnCount(value: unknown): PageColumnCount {
  const count = Number(value)
  if (count === 2 || count === 3) return count
  return 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function clampPageMarginMm(value: unknown, fallback = 20): number {
  const next = Number(value)
  const base = Number.isFinite(next) ? next : fallback
  return Math.max(8, Math.min(60, Math.round(base)))
}

export function normalizePageMarginsMm(value: unknown, fallback = 20): PageMarginsMm {
  const uniform = clampPageMarginMm(fallback)
  if (!isRecord(value)) {
    return { top: uniform, right: uniform, bottom: uniform, left: uniform }
  }
  return {
    top: clampPageMarginMm(value.top, uniform),
    right: clampPageMarginMm(value.right, uniform),
    bottom: clampPageMarginMm(value.bottom, uniform),
    left: clampPageMarginMm(value.left, uniform),
  }
}

export function pageMarginsCss(value: unknown, fallback = 20): string {
  const margins = normalizePageMarginsMm(value, fallback)
  return `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`
}

export function pageMarginsSummary(value: unknown, fallback = 20): string {
  const margins = normalizePageMarginsMm(value, fallback)
  if (
    margins.top === margins.right &&
    margins.right === margins.bottom &&
    margins.bottom === margins.left
  ) {
    return `${margins.top}mm`
  }
  return `상${margins.top} 우${margins.right} 하${margins.bottom} 좌${margins.left}mm`
}

export function normalizeZoom(value: unknown, fallback = 1): number {
  const next = Number(value)
  const base = Number.isFinite(next) ? next : fallback
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(base * 100) / 100))
}

export function normalizeViewLayout(value: unknown): ViewLayoutMode {
  return value === 'draft' ? 'draft' : 'print'
}

export function normalizeMemoPageSettings(value: unknown, fallback: MemoPageSettings = DEFAULT_MEMO_PAGE_SETTINGS): MemoPageSettings {
  const raw = isRecord(value) ? value : {}
  const pageSize = typeof raw.pageSize === 'string' && (raw.pageSize === 'custom' || raw.pageSize in PAGE_PRESETS)
    ? raw.pageSize as PageSizePreset
    : fallback.pageSize
  const pageOrientation = raw.pageOrientation === 'landscape' || raw.pageOrientation === 'portrait'
    ? raw.pageOrientation
    : fallback.pageOrientation
  const paperStyle = PAPER_STYLES.some((style) => style.value === raw.paperStyle)
    ? raw.paperStyle as PaperStyle
    : fallback.paperStyle
  const pageMarginMm = clampPageMarginMm(raw.pageMarginMm, fallback.pageMarginMm)
  const pageMarginsMm = normalizePageMarginsMm(raw.pageMarginsMm, pageMarginMm)
  return {
    paperStyle,
    pageSize,
    pageOrientation,
    pageMarginMm,
    pageMarginsMm,
    pageColumnCount: normalizePageColumnCount(raw.pageColumnCount ?? fallback.pageColumnCount),
    runningHeader: typeof raw.runningHeader === 'string' ? raw.runningHeader.trim() : fallback.runningHeader,
    runningFooter: typeof raw.runningFooter === 'string' ? raw.runningFooter.trim() : fallback.runningFooter,
    customPageWidthMm: clampCustomPageMm(raw.customPageWidthMm, fallback.customPageWidthMm),
    customPageHeightMm: clampCustomPageMm(raw.customPageHeightMm, fallback.customPageHeightMm),
    gutterMm: Math.max(0, Math.min(30, Math.round(Number(raw.gutterMm ?? fallback.gutterMm) || 0))),
    gutterPosition: raw.gutterPosition === 'top' ? 'top' : (raw.gutterPosition === 'left' ? 'left' : fallback.gutterPosition),
    pageNumberFormat: normalizePageNumberFormat(raw.pageNumberFormat ?? fallback.pageNumberFormat),
    pageNumberStart: normalizePageNumberStart(raw.pageNumberStart ?? fallback.pageNumberStart),
    firstPageRunningOff: typeof raw.firstPageRunningOff === 'boolean' ? raw.firstPageRunningOff : fallback.firstPageRunningOff,
    watermarkText: typeof raw.watermarkText === 'string' ? raw.watermarkText.trim().slice(0, 40) : fallback.watermarkText,
    design: normalizeDesign(raw.design, fallback.design),
    layout: normalizeLayout(raw.layout, fallback.layout),
    styles: normalizeStyleSheet(raw.styles, fallback.styles),
  }
}

/** 저장본에서 온 디자인 값을 믿을 수 있는 모양으로 다듬는다 */
export function normalizeDesign(value: unknown, fallback: DocDesign = DEFAULT_DESIGN): DocDesign {
  const raw = isRecord(value) ? value : {}
  const border = isRecord(raw.pageBorder) ? raw.pageBorder : {}
  const mark = isRecord(raw.watermark) ? raw.watermark : {}
  const str = (v: unknown, def: string) => (typeof v === 'string' && v ? v : def)
  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
  }
  return {
    styleSet: str(raw.styleSet, fallback.styleSet),
    themeColor: str(raw.themeColor, fallback.themeColor),
    themeFont: str(raw.themeFont, fallback.themeFont),
    paraSpacing: str(raw.paraSpacing, fallback.paraSpacing),
    effect: str(raw.effect, fallback.effect),
    pageColor: str(raw.pageColor, fallback.pageColor),
    pageBorder: {
      style: str(border.style, fallback.pageBorder.style),
      color: /^#[0-9a-f]{3,8}$/i.test(String(border.color)) ? String(border.color) : fallback.pageBorder.color,
      width: num(border.width, fallback.pageBorder.width, 0.5, 12),
      padding: num(border.padding, fallback.pageBorder.padding, 0, 48),
      first: typeof border.first === 'boolean' ? border.first : fallback.pageBorder.first,
    },
    watermark: {
      text: typeof mark.text === 'string' ? mark.text.slice(0, 40) : fallback.watermark.text,
      color: /^#[0-9a-f]{3,8}$/i.test(String(mark.color)) ? String(mark.color) : fallback.watermark.color,
      opacity: num(mark.opacity, fallback.watermark.opacity, 2, 100),
      angle: num(mark.angle, fallback.watermark.angle, -90, 90),
      size: num(mark.size, fallback.watermark.size, 12, 200),
    },
  }
}

export function pageSettingsFromUi(state: Pick<UIState, keyof MemoPageSettings>): MemoPageSettings {
  return normalizeMemoPageSettings({
    paperStyle: state.paperStyle,
    pageSize: state.pageSize,
    pageOrientation: state.pageOrientation,
    pageMarginMm: state.pageMarginMm,
    pageMarginsMm: state.pageMarginsMm,
    pageColumnCount: state.pageColumnCount,
    runningHeader: state.runningHeader,
    runningFooter: state.runningFooter,
    customPageWidthMm: state.customPageWidthMm,
    customPageHeightMm: state.customPageHeightMm,
    gutterMm: state.gutterMm,
    gutterPosition: state.gutterPosition,
    pageNumberFormat: state.pageNumberFormat,
    pageNumberStart: state.pageNumberStart,
    firstPageRunningOff: state.firstPageRunningOff,
    watermarkText: state.watermarkText,
    design: state.design,
    layout: state.layout,
    styles: state.styles,
  })
}

export function sameMemoPageSettings(a: unknown, b: unknown): boolean {
  const left = normalizeMemoPageSettings(a)
  const right = normalizeMemoPageSettings(b)
  return left.paperStyle === right.paperStyle &&
    left.pageSize === right.pageSize &&
    left.pageOrientation === right.pageOrientation &&
    left.pageMarginMm === right.pageMarginMm &&
    left.pageColumnCount === right.pageColumnCount &&
    left.runningHeader === right.runningHeader &&
    left.runningFooter === right.runningFooter &&
    left.pageMarginsMm.top === right.pageMarginsMm.top &&
    left.pageMarginsMm.right === right.pageMarginsMm.right &&
    left.pageMarginsMm.bottom === right.pageMarginsMm.bottom &&
    left.pageMarginsMm.left === right.pageMarginsMm.left &&
    left.customPageWidthMm === right.customPageWidthMm &&
    left.customPageHeightMm === right.customPageHeightMm &&
    left.gutterMm === right.gutterMm &&
    left.gutterPosition === right.gutterPosition &&
    left.pageNumberFormat === right.pageNumberFormat &&
    left.pageNumberStart === right.pageNumberStart &&
    left.firstPageRunningOff === right.firstPageRunningOff &&
    left.watermarkText === right.watermarkText &&
    JSON.stringify(left.design) === JSON.stringify(right.design) &&
    JSON.stringify(left.layout) === JSON.stringify(right.layout) &&
    sameStyleSheet(left.styles, right.styles)
}

export function formatRunningText(template: string, page = 1, total = 1): string {
  return template
    .replace(/\{page\}/g, String(Math.max(1, Math.round(page))))
    .replace(/\{total\}/g, String(Math.max(1, Math.round(total))))
    .trim()
}

/**
 * Phase 17 — UI 상태 (포커스/읽기 모드 + 페이지 줌 + spellcheck + collapse + heading 번호).
 */
interface UIState {
  focusMode: boolean
  readingMode: boolean
  /** 타자기 모드 — 커서 줄을 화면 중앙에 고정 (iA Writer 스타일) */
  typewriterMode: boolean
  /** 현재 문단 하이라이트 — 커서가 있는 문단 외에는 흐리게 (포커스 라이팅) */
  paragraphFocus: boolean
  /** 쪽모음 패널 — 페이지 축소판을 편집기 옆에 나열 (HWP 쪽모음, 편집과 공존) */
  pageThumbs: boolean
  /** 분할 편집 — 같은 문서를 두 창에서 동시 편집 (Word 창 분할) */
  splitView: boolean
  /** 분할 방향 — 'h': 위·아래(기본, 용지 폭 온전히 유지) · 'v': 좌우 */
  splitDir: 'h' | 'v'
  /** 첫 창이 차지하는 비율 (0.2~0.8) — 분할선 드래그로 조절 */
  splitRatio: number
  /** 쪽 나란히 편집 — 한 번에 가로로 놓을 쪽 수 (0=꺼짐, 2~4) */
  spreadCols: 0 | 2 | 3 | 4
  /**
   * 페이지 구현 방식
   * - 'legacy'  : 데코레이션 눈금 (구버전)
   * - 'nodes'   : 용지마다 실제 페이지 노드 + 자동 리플로우 (문단 단위 분할)
   * - 'columns' : CSS 다단으로 브라우저가 줄 단위 분할 (워드·한글과 같은 흐름)
   */
  pageModel: 'legacy' | 'nodes' | 'columns'
  spellCheck: boolean
  sidebarCollapsed: boolean
  headingNumbers: boolean
  showRulers: boolean
  viewLayout: ViewLayoutMode
  zoom: number // 0.35 ~ 2.0
  paperStyle: PaperStyle
  pageSize: PageSizePreset
  pageOrientation: PageOrientation
  pageMarginMm: number
  pageMarginsMm: PageMarginsMm
  pageColumnCount: PageColumnCount
  runningHeader: string
  runningFooter: string
  customPageWidthMm: number
  customPageHeightMm: number
  gutterMm: number
  gutterPosition: GutterPosition
  pageNumberFormat: PageNumberFormat
  pageNumberStart: number
  firstPageRunningOff: boolean
  watermarkText: string
  /** 문서 디자인 한 벌 — 워드 「디자인」 탭 */
  design: DocDesign
  /** 쪽 배치 — 워드 「레이아웃」 탭 */
  layout: DocLayout
  /** 이름 있는 스타일 한 벌 — 워드 「스타일」 창 */
  styles: StyleSheet
  toggleFocus: () => void
  setFocus: (v: boolean) => void
  toggleReading: () => void
  toggleTypewriter: () => void
  toggleParagraphFocus: () => void
  togglePageThumbs: () => void
  setPageThumbs: (v: boolean) => void
  toggleSplitView: () => void
  setSplitDir: (dir: 'h' | 'v') => void
  setSplitRatio: (ratio: number) => void
  setSpreadCols: (cols: 0 | 2 | 3 | 4) => void
  setPageModel: (model: 'legacy' | 'nodes' | 'columns') => void
  toggleSpellCheck: () => void
  toggleSidebar: () => void
  toggleHeadingNumbers: () => void
  toggleRulers: () => void
  setRulers: (visible: boolean) => void
  setViewLayout: (mode: ViewLayoutMode) => void
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  setPaperStyle: (style: PaperStyle) => void
  setPageSize: (size: PageSizePreset) => void
  setPageOrientation: (orientation: PageOrientation) => void
  setPageMarginMm: (margin: number) => void
  setPageMarginsMm: (margins: PageMarginsMm) => void
  setPageColumnCount: (count: PageColumnCount) => void
  setRunningHeader: (value: string) => void
  setRunningFooter: (value: string) => void
  /** 마지막으로 적용한 논문 양식 (인용 표기 등 뒤따르는 기능이 이걸 따른다) */
  paperFormat: string
  setPaperFormat: (key: string) => void
  applyPageSettings: (settings: Partial<MemoPageSettings>) => void
  setDesign: (patch: Partial<DocDesign>) => void
  setLayout: (patch: Partial<DocLayout>) => void
  /** 스타일 한 벌을 통째로 갈아 끼운다 (스타일 창이 쓴다) */
  setStyleSheet: (sheet: StyleSheet) => void
  /** 스타일 하나만 고친다 — 고치는 순간 그 표를 단 글이 모두 함께 바뀐다 */
  updateStyle: (id: string, patch: Partial<NamedStyle>) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      /* 새 문서의 디자인 — 「기본값으로 설정」 해 둔 것이 있으면 그것으로 시작한다 */
      design: (() => {
        try {
          const saved = localStorage.getItem('jan-v2-design-default')
          return saved ? normalizeDesign(JSON.parse(saved)) : DEFAULT_DESIGN
        } catch {
          return DEFAULT_DESIGN
        }
      })(),
      layout: DEFAULT_LAYOUT,
      styles: DEFAULT_STYLE_SHEET,
      focusMode: false,
      readingMode: false,
      typewriterMode: false,
      paragraphFocus: false,
      pageThumbs: false,
      splitView: false,
      splitDir: 'h',
      splitRatio: 0.5,
      spreadCols: 0,
      pageModel: 'nodes',
      spellCheck: false,
      sidebarCollapsed: false,
      headingNumbers: false,
      showRulers: true,
      viewLayout: 'print',
      zoom: 1,
      paperStyle: 'lined',
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMarginMm: 20,
      pageMarginsMm: { top: 20, right: 20, bottom: 20, left: 20 },
      pageColumnCount: 1,
      runningHeader: '',
      runningFooter: DEFAULT_RUNNING_FOOTER,
      customPageWidthMm: 210,
      customPageHeightMm: 297,
      gutterMm: 0,
      gutterPosition: 'left',
      pageNumberFormat: 'arabic',
      pageNumberStart: 1,
      firstPageRunningOff: false,
      watermarkText: '',
      toggleFocus: () => set({ focusMode: !get().focusMode }),
      toggleReading: () => set({ readingMode: !get().readingMode }),
      toggleTypewriter: () => set({ typewriterMode: !get().typewriterMode }),
      toggleParagraphFocus: () => set({ paragraphFocus: !get().paragraphFocus }),
      togglePageThumbs: () => set({ pageThumbs: !get().pageThumbs }),
      setPageThumbs: (v) => set({ pageThumbs: v }),
      toggleSplitView: () => set({ splitView: !get().splitView }),
      setSplitDir: (dir) => set({ splitDir: dir === 'v' ? 'v' : 'h' }),
      setSplitRatio: (ratio) => set({ splitRatio: Math.max(0.2, Math.min(0.8, ratio)) }),
      // 쪽 나란히 편집을 켜면 창 나누기는 끈다 (둘은 화면을 다투는 배타 모드)
      setSpreadCols: (cols) => set(cols ? { spreadCols: cols, splitView: false } : { spreadCols: 0 }),
      setPageModel: (model) => set({ pageModel: model === 'nodes' || model === 'columns' ? model : 'legacy' }),
      toggleSpellCheck: () => set({ spellCheck: !get().spellCheck }),
      setFocus: (v) => set({ focusMode: v }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      toggleHeadingNumbers: () => set({ headingNumbers: !get().headingNumbers }),
      toggleRulers: () => set({ showRulers: !get().showRulers }),
      setRulers: (visible) => set({ showRulers: visible }),
      setViewLayout: (mode) => set({ viewLayout: normalizeViewLayout(mode) }),
      setZoom: (zoom) => set({ zoom: normalizeZoom(zoom, get().zoom) }),
      zoomIn: () => set({ zoom: normalizeZoom(get().zoom + 0.1, get().zoom) }),
      zoomOut: () => set({ zoom: normalizeZoom(get().zoom - 0.1, get().zoom) }),
      zoomReset: () => set({ zoom: 1 }),
      setPaperStyle: (style) => set({ paperStyle: style }),
      setPageSize: (size) => set({ pageSize: size }),
      setPageOrientation: (orientation) => set({ pageOrientation: orientation }),
      setPageMarginMm: (margin) => {
        const next = clampPageMarginMm(margin)
        set({ pageMarginMm: next, pageMarginsMm: { top: next, right: next, bottom: next, left: next } })
      },
      setPageMarginsMm: (margins) => {
        const next = normalizePageMarginsMm(margins)
        set({
          pageMarginMm: Math.round((next.top + next.right + next.bottom + next.left) / 4),
          pageMarginsMm: next,
        })
      },
      setPageColumnCount: (count) => set({ pageColumnCount: normalizePageColumnCount(count) }),
      paperFormat: '',
      setPaperFormat: (key) => set({ paperFormat: key }),
      setRunningHeader: (value) => set({ runningHeader: value.trim() }),
      setRunningFooter: (value) => set({ runningFooter: value.trim() }),
      applyPageSettings: (settings) => {
        // Partial 병합: 지정 안 된 필드는 현재 값을 유지해야 한다 (normalize 기본값으로 덮어쓰면 안 됨)
        const cur = get()
        const next = normalizeMemoPageSettings(settings, pageSettingsFromUi(cur))
        set({
          paperStyle: next.paperStyle,
          pageSize: next.pageSize,
          pageOrientation: next.pageOrientation,
          pageMarginMm: next.pageMarginMm,
          pageMarginsMm: next.pageMarginsMm,
          pageColumnCount: next.pageColumnCount,
          runningHeader: next.runningHeader,
          runningFooter: next.runningFooter,
          customPageWidthMm: next.customPageWidthMm,
          customPageHeightMm: next.customPageHeightMm,
          gutterMm: next.gutterMm,
          gutterPosition: next.gutterPosition,
          pageNumberFormat: next.pageNumberFormat,
          pageNumberStart: next.pageNumberStart,
          firstPageRunningOff: next.firstPageRunningOff,
          watermarkText: next.watermarkText,
          design: next.design,
          layout: next.layout,
          styles: next.styles,
        })
        applyDesign(next.design) // 화면(그리고 인쇄)에 바로 입힌다
        applyLayout(next.layout)
        applyStyleSheet(next.styles)
      },
      /** 쪽 배치 한 가지만 바꾼다 — 워드 「레이아웃」 탭의 단추들이 쓴다 */
      setLayout: (patch) => {
        const next = normalizeLayout({ ...get().layout, ...patch }, get().layout)
        set({ layout: next })
        applyLayout(next)
      },
      /** 디자인 한 가지만 바꾼다 — 워드 「디자인」 탭의 단추들이 쓴다 */
      setDesign: (patch) => {
        const next = normalizeDesign({ ...get().design, ...patch }, get().design)
        set({ design: next })
        applyDesign(next)
      },
      /** 스타일 한 벌을 통째로 — 스타일 창이 쓴다 */
      setStyleSheet: (sheet) => {
        const next = normalizeStyleSheet(sheet, get().styles)
        set({ styles: next })
        applyStyleSheet(next)
      },
      /**
       * 스타일 하나만 고친다. 문서는 건드리지 않는다 —
       * 표를 단 글이 함께 바뀌는 것은 CSS 한 장이 갈리기 때문이다.
       */
      updateStyle: (id, patch) => {
        const cur = get().styles
        const next = normalizeStyleSheet({
          styles: cur.styles.map((s) => (s.id === id
            ? { ...s, ...patch, id: s.id, props: patch.props ? { ...s.props, ...patch.props } : s.props }
            : s)),
        }, cur)
        set({ styles: next })
        applyStyleSheet(next)
      },
    }),
    {
      name: 'jan-v2-ui',
      version: 1,
      // v0 사용자는 pageModel 이 없다 → 독립 페이지 모델로 이관
      // (명시적으로 'legacy' 를 고른 설정은 그대로 존중한다)
      migrate: (persisted, from) => {
        const state = (persisted || {}) as Record<string, unknown>
        if (from < 1 && state.pageModel !== 'legacy') state.pageModel = 'nodes'
        return state as never
      },
    }
  )
)
