import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Phase 15 — 타이포그래피 설정.
 * 글꼴 / 줄간격 / 단락 간격 — body class 또는 CSS variable 로 적용.
 */
/** 미리 준비한 글꼴 묶음 이름, 또는 이 컴퓨터에 깔린 글꼴의 CSS 값(예: '"맑은 고딕"') */
export type FontFamily = 'sans' | 'serif' | 'mono' | (string & {})
export type TypographyPresetId = 'default' | 'compact' | 'manuscript' | 'large' | 'code'
export type TypographyActivePreset = TypographyPresetId | 'custom'

export interface TypographySettings {
  fontFamily: FontFamily
  lineHeight: number
  paragraphSpacing: number
  fontSize: number
  /** 자간 % — 음수면 좁아진다 (글자 크기 대비) */
  letterSpacing: number
  /** 장평 % — 100 보다 작으면 홀쭉, 크면 넓적 */
  charScale: number
  /** 첫 줄 들여쓰기 (글자 수) */
  textIndent: number
  /** 본문 정렬 — 논문·보고서는 양쪽 정렬이 기본 */
  align: 'left' | 'justify'
}

/** 문서 기본값에서 자간·장평·들여쓰기·정렬을 뺀 나머지는 예전 프리셋 값 그대로 */
const KOREAN_DEFAULTS = { letterSpacing: 0, charScale: 100, textIndent: 0, align: 'left' as const }

export interface TypographyPreset extends TypographySettings {
  id: TypographyPresetId
  label: string
  description: string
}

export const FONT_FAMILIES: Array<{ value: 'sans' | 'serif' | 'mono'; label: string; description: string }> = [
  { value: 'sans', label: '기본 고딕', description: '노트와 업무 문서에 어울리는 기본값' },
  { value: 'serif', label: '명조', description: '원고, 보고서, 논문 스타일' },
  { value: 'mono', label: '고정폭', description: '코드, 표, 기술 메모에 적합' },
]

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  {
    id: 'default',
    label: '기본 문서',
    description: 'v1 노트에 가까운 균형 잡힌 줄간격',
    fontFamily: 'sans',
    lineHeight: 1.7,
    paragraphSpacing: 8,
    fontSize: 14,
    ...KOREAN_DEFAULTS,
  },
  {
    id: 'compact',
    label: '촘촘한 노트',
    description: '노트북과 모바일에서 긴 내용을 많이 볼 때',
    fontFamily: 'sans',
    lineHeight: 1.5,
    paragraphSpacing: 4,
    fontSize: 13,
    ...KOREAN_DEFAULTS,
  },
  {
    id: 'manuscript',
    label: '원고/논문',
    description: '명조 글꼴과 넉넉한 행간의 Word식 원고',
    fontFamily: 'serif',
    lineHeight: 1.9,
    paragraphSpacing: 12,
    fontSize: 15,
    ...KOREAN_DEFAULTS,
  },
  {
    id: 'large',
    label: '큰 글씨',
    description: '태블릿 발표, 회의실 화면, 접근성용',
    fontFamily: 'sans',
    lineHeight: 1.8,
    paragraphSpacing: 14,
    fontSize: 18,
    ...KOREAN_DEFAULTS,
  },
  {
    id: 'code',
    label: '코드 노트',
    description: '기술 메모와 로그 정리에 맞춘 고정폭',
    fontFamily: 'mono',
    lineHeight: 1.55,
    paragraphSpacing: 6,
    fontSize: 13,
    ...KOREAN_DEFAULTS,
  },
]

interface TypographyState {
  fontFamily: FontFamily
  presetId: TypographyActivePreset
  lineHeight: number // 1.2 ~ 2.4
  paragraphSpacing: number // 0 ~ 24 (px)
  fontSize: number // 10 ~ 22 (px, ProseMirror base)
  letterSpacing: number // 자간 %
  charScale: number // 장평 %
  textIndent: number // 첫 줄 들여쓰기 (글자 수)
  align: 'left' | 'justify'
  setFontFamily: (f: FontFamily) => void
  setLineHeight: (n: number) => void
  setParagraphSpacing: (n: number) => void
  setFontSize: (n: number) => void
  setLetterSpacing: (n: number) => void
  setCharScale: (n: number) => void
  setTextIndent: (n: number) => void
  setAlign: (v: 'left' | 'justify') => void
  applyPreset: (id: TypographyPresetId) => void
  apply: () => void
  reset: () => void
}

const FONT_STACK: Record<'sans' | 'serif' | 'mono', string> = {
  sans: '"Noto Sans KR","Malgun Gothic",-apple-system,BlinkMacSystemFont,sans-serif',
  serif: '"Noto Serif KR","Nanum Myeongjo",Georgia,serif',
  mono: '"D2Coding","Consolas","Courier New",monospace',
}

export function getTypographyFontStack(fontFamily: FontFamily): string {
  return FONT_STACK[fontFamily as 'sans' | 'serif' | 'mono'] || (fontFamily || FONT_STACK.sans)
}

/* 워드·한글처럼 값을 직접 입력할 수 있게 폭을 넓혔다 (미리 정한 눈금에 갇히지 않는다) */
const LIMITS = {
  fontSize: { min: 4, max: 200 },
  lineHeight: { min: 0.5, max: 5 },
  paragraphSpacing: { min: 0, max: 200 },
  letterSpacing: { min: -50, max: 100 },
  charScale: { min: 10, max: 250 },
  textIndent: { min: 0, max: 20 },
}

const DEFAULT_PRESET = TYPOGRAPHY_PRESETS[0]
export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontFamily: DEFAULT_PRESET.fontFamily,
  lineHeight: DEFAULT_PRESET.lineHeight,
  paragraphSpacing: DEFAULT_PRESET.paragraphSpacing,
  fontSize: DEFAULT_PRESET.fontSize,
  ...KOREAN_DEFAULTS,
}

/** 미리 준비한 묶음('sans'·'serif'·'mono') 인가 */
export function isFontFamily(value: string): boolean {
  return FONT_FAMILIES.some((family) => family.value === value)
}

export function normalizeFontFamily(value: string): FontFamily {
  if (isFontFamily(value)) return value
  // 사용자가 고른 시스템 글꼴은 CSS 값 그대로 쓴다
  const trimmed = (value || '').trim()
  return trimmed || DEFAULT_TYPOGRAPHY.fontFamily
}

export function getTypographyPreset(id: TypographyPresetId) {
  return TYPOGRAPHY_PRESETS.find((preset) => preset.id === id) || DEFAULT_PRESET
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function clampTypographySettings(settings: TypographySettings): TypographySettings {
  return {
    fontFamily: normalizeFontFamily(settings.fontFamily),
    fontSize: clamp(Math.round(settings.fontSize), LIMITS.fontSize.min, LIMITS.fontSize.max),
    lineHeight: Number(clamp(settings.lineHeight, LIMITS.lineHeight.min, LIMITS.lineHeight.max).toFixed(2)),
    paragraphSpacing: clamp(Math.round(settings.paragraphSpacing), LIMITS.paragraphSpacing.min, LIMITS.paragraphSpacing.max),
    letterSpacing: Number(clamp(settings.letterSpacing ?? 0, LIMITS.letterSpacing.min, LIMITS.letterSpacing.max).toFixed(1)),
    charScale: Math.round(clamp(settings.charScale ?? 100, LIMITS.charScale.min, LIMITS.charScale.max)),
    textIndent: Number(clamp(settings.textIndent ?? 0, LIMITS.textIndent.min, LIMITS.textIndent.max).toFixed(2)),
    align: settings.align === 'justify' ? 'justify' : 'left',
  }
}

export function detectTypographyPreset(settings: TypographySettings): TypographyActivePreset {
  const normalized = clampTypographySettings(settings)
  const matched = TYPOGRAPHY_PRESETS.find((preset) => (
    preset.fontFamily === normalized.fontFamily
    && preset.fontSize === normalized.fontSize
    && preset.lineHeight === normalized.lineHeight
    && preset.paragraphSpacing === normalized.paragraphSpacing
  ))
  return matched?.id || 'custom'
}

function applyVars(s: TypographySettings) {
  if (typeof document === 'undefined') return
  const normalized = clampTypographySettings(s)
  const r = document.documentElement
  r.style.setProperty('--jan-editor-font', getTypographyFontStack(normalized.fontFamily))
  r.style.setProperty('--jan-editor-line', String(normalized.lineHeight))
  r.style.setProperty('--jan-editor-para', normalized.paragraphSpacing + 'px')
  r.style.setProperty('--jan-editor-size', normalized.fontSize + 'px')
  r.style.setProperty('--jan-editor-tracking', (normalized.letterSpacing / 100) + 'em')
  r.style.setProperty('--jan-editor-indent', normalized.textIndent + 'em')
  r.style.setProperty('--jan-editor-align', normalized.align)
  /* 장평은 글자를 가로로 늘리고 줄이는 것 — CSS 에는 그런 속성이 없어 문단을 그만큼
     넓게 잡고 다시 눌러 그린다(한글의 장평과 같은 결과). 100% 면 아예 걸지 않는다. */
  const scale = normalized.charScale / 100
  r.style.setProperty('--jan-editor-scale', String(scale))
  r.style.setProperty('--jan-editor-scale-w', (100 / scale).toFixed(3) + '%')
  if (normalized.charScale === 100) r.removeAttribute('data-jan-scaled')
  else r.setAttribute('data-jan-scaled', '1')
}

export const useTypographyStore = create<TypographyState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_TYPOGRAPHY,
      presetId: 'default',
      setFontFamily: (f) => { set({ fontFamily: f, presetId: 'custom' }); applyVars(get()) },
      setLineHeight: (n) => { set({ lineHeight: n, presetId: 'custom' }); applyVars(get()) },
      setParagraphSpacing: (n) => { set({ paragraphSpacing: n, presetId: 'custom' }); applyVars(get()) },
      setFontSize: (n) => { set({ fontSize: n, presetId: 'custom' }); applyVars(get()) },
      setLetterSpacing: (n) => { set({ letterSpacing: n, presetId: 'custom' }); applyVars(get()) },
      setCharScale: (n) => { set({ charScale: n, presetId: 'custom' }); applyVars(get()) },
      setTextIndent: (n) => { set({ textIndent: n, presetId: 'custom' }); applyVars(get()) },
      setAlign: (v) => { set({ align: v, presetId: 'custom' }); applyVars(get()) },
      applyPreset: (id) => {
        const preset = getTypographyPreset(id)
        const next = clampTypographySettings(preset)
        set({ ...next, presetId: preset.id })
        applyVars(next)
      },
      apply: () => applyVars(get()),
      reset: () => {
        set({ ...DEFAULT_TYPOGRAPHY, presetId: 'default' })
        applyVars(DEFAULT_TYPOGRAPHY)
      },
    }),
    { name: 'jan-v2-typography' }
  )
)
