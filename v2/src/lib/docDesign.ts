/**
 * 문서 디자인 — 워드 「디자인」 탭 자리.
 *
 * 워드는 「문서 서식」 갤러리에서 제목·본문의 생김새를 한 벌씩 고르고,
 * 테마 색·테마 글꼴로 그 벌의 색과 글꼴만 갈아 끼운다. 페이지 배경(워터마크·쪽 색·쪽 테두리)도 여기 있다.
 * 우리도 같은 얼개를 쓰되, 한글 문서에 맞는 벌(보고서·논문·계약서 등)을 함께 넣는다.
 */

export interface StyleSet {
  key: string
  label: string
  hint: string
  /** 본문 */
  bodyFont: 'sans' | 'serif' | 'mono'
  bodySize: number
  lineHeight: number
  paraSpacing: number
  /** 첫 줄 들여쓰기 (글자 수) */
  indent: number
  align: 'left' | 'justify'
  /** 제목 */
  headFont: 'sans' | 'serif' | 'mono'
  /** h1 크기 배수 (본문 대비) */
  headScale: number
  headWeight: number
  /** 제목 아래 선 */
  headRule: 'none' | 'thin' | 'thick' | 'accent'
  headSpaceBefore: number
  headCase: 'none' | 'upper'
  /** 제목 색을 테마 색으로 칠할까 */
  headTinted: boolean
}

/** 워드의 「문서 서식」 갤러리 — 한 벌을 고르면 제목·본문이 함께 바뀐다 */
export const STYLE_SETS: StyleSet[] = [
  { key: 'basic', label: '기본', hint: '무난한 고딕 — 업무 문서', bodyFont: 'sans', bodySize: 14, lineHeight: 1.7, paraSpacing: 8, indent: 0, align: 'left', headFont: 'sans', headScale: 1.9, headWeight: 700, headRule: 'none', headSpaceBefore: 18, headCase: 'none', headTinted: false },
  { key: 'report', label: '보고서', hint: '제목에 색 띠 — 사내 보고서', bodyFont: 'sans', bodySize: 14, lineHeight: 1.72, paraSpacing: 10, indent: 0, align: 'justify', headFont: 'sans', headScale: 1.8, headWeight: 700, headRule: 'accent', headSpaceBefore: 22, headCase: 'none', headTinted: true },
  { key: 'thesis', label: '논문', hint: '명조 본문·들여쓰기 — 학술', bodyFont: 'serif', bodySize: 13.5, lineHeight: 1.85, paraSpacing: 4, indent: 1, align: 'justify', headFont: 'serif', headScale: 1.55, headWeight: 700, headRule: 'none', headSpaceBefore: 20, headCase: 'none', headTinted: false },
  { key: 'contract', label: '계약서', hint: '조·항이 또렷한 격식', bodyFont: 'serif', bodySize: 13, lineHeight: 1.8, paraSpacing: 6, indent: 1, align: 'justify', headFont: 'serif', headScale: 1.35, headWeight: 700, headRule: 'thin', headSpaceBefore: 18, headCase: 'none', headTinted: false },
  { key: 'proposal', label: '제안서', hint: '큰 제목·넉넉한 여백', bodyFont: 'sans', bodySize: 14.5, lineHeight: 1.8, paraSpacing: 12, indent: 0, align: 'left', headFont: 'sans', headScale: 2.2, headWeight: 800, headRule: 'thick', headSpaceBefore: 26, headCase: 'none', headTinted: true },
  { key: 'minimal', label: '미니멀', hint: '장식 없이 글에 집중', bodyFont: 'sans', bodySize: 14, lineHeight: 1.75, paraSpacing: 10, indent: 0, align: 'left', headFont: 'sans', headScale: 1.5, headWeight: 600, headRule: 'none', headSpaceBefore: 16, headCase: 'none', headTinted: false },
  { key: 'classic', label: '고전', hint: '명조 제목 — 단행본 느낌', bodyFont: 'serif', bodySize: 14, lineHeight: 1.9, paraSpacing: 2, indent: 1, align: 'justify', headFont: 'serif', headScale: 1.7, headWeight: 700, headRule: 'thin', headSpaceBefore: 24, headCase: 'none', headTinted: false },
  { key: 'modern', label: '모던', hint: '대문자 제목·촘촘한 본문', bodyFont: 'sans', bodySize: 13.5, lineHeight: 1.62, paraSpacing: 8, indent: 0, align: 'left', headFont: 'sans', headScale: 1.6, headWeight: 800, headRule: 'thick', headSpaceBefore: 20, headCase: 'upper', headTinted: true },
  { key: 'manual', label: '설명서', hint: '단계가 잘 보이는 구조', bodyFont: 'sans', bodySize: 13.5, lineHeight: 1.7, paraSpacing: 8, indent: 0, align: 'left', headFont: 'sans', headScale: 1.45, headWeight: 700, headRule: 'accent', headSpaceBefore: 18, headCase: 'none', headTinted: true },
  { key: 'letter', label: '편지', hint: '한 줄 한 줄이 편안하게', bodyFont: 'serif', bodySize: 14.5, lineHeight: 2, paraSpacing: 10, indent: 1, align: 'left', headFont: 'serif', headScale: 1.4, headWeight: 600, headRule: 'none', headSpaceBefore: 16, headCase: 'none', headTinted: false },
  { key: 'press', label: '보도자료', hint: '제목이 크고 본문은 촘촘', bodyFont: 'sans', bodySize: 13, lineHeight: 1.6, paraSpacing: 6, indent: 0, align: 'justify', headFont: 'sans', headScale: 2, headWeight: 800, headRule: 'thin', headSpaceBefore: 18, headCase: 'none', headTinted: false },
  { key: 'code', label: '기술 문서', hint: '고정폭 — 코드가 많은 글', bodyFont: 'mono', bodySize: 13, lineHeight: 1.65, paraSpacing: 8, indent: 0, align: 'left', headFont: 'sans', headScale: 1.5, headWeight: 700, headRule: 'thin', headSpaceBefore: 18, headCase: 'none', headTinted: true },
]

/** 테마 색 — 제목·강조·표 머리에 함께 쓰인다 (워드 「색」) */
export interface ThemeColor { key: string; label: string; colors: [string, string, string, string, string, string] }

export const THEME_COLORS: ThemeColor[] = [
  { key: 'office', label: 'Office', colors: ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'] },
  { key: 'jan', label: '주황(기본)', colors: ['#d97757', '#c2410c', '#a16207', '#4d7c0f', '#0e7490', '#6d28d9'] },
  { key: 'blue', label: '푸른 계열', colors: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1e3a8a'] },
  { key: 'forest', label: '숲', colors: ['#166534', '#15803d', '#4d7c0f', '#65a30d', '#84cc16', '#365314'] },
  { key: 'wine', label: '와인', colors: ['#7f1d1d', '#991b1b', '#b91c1c', '#be123c', '#9f1239', '#881337'] },
  { key: 'slate', label: '무채색', colors: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#1e293b'] },
  { key: 'ocean', label: '바다', colors: ['#0e7490', '#0891b2', '#06b6d4', '#22d3ee', '#0284c7', '#075985'] },
  { key: 'plum', label: '자두', colors: ['#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c026d3', '#581c87'] },
]

/** 테마 글꼴 — 제목/본문 짝 (워드 「글꼴」) */
export interface ThemeFont { key: string; label: string; head: string; body: string }

export const THEME_FONTS: ThemeFont[] = [
  { key: 'default', label: '기본 (고딕/고딕)', head: 'sans', body: 'sans' },
  { key: 'serif-serif', label: '명조 / 명조', head: 'serif', body: 'serif' },
  { key: 'sans-serif', label: '고딕 제목 / 명조 본문', head: 'sans', body: 'serif' },
  { key: 'serif-sans', label: '명조 제목 / 고딕 본문', head: 'serif', body: 'sans' },
  { key: 'mono-sans', label: '고정폭 제목 / 고딕 본문', head: 'mono', body: 'sans' },
]

/** 단락 간격 — 워드 「단락 간격」 */
export const PARA_SPACING_SETS: Array<{ key: string; label: string; line: number; before: number; after: number }> = [
  { key: 'none', label: '스타일 집합 기본값', line: 1.7, before: 0, after: 8 },
  { key: 'compact', label: '좁게', line: 1.45, before: 0, after: 4 },
  { key: 'tight', label: '조금 좁게', line: 1.55, before: 0, after: 6 },
  { key: 'open', label: '조금 넓게', line: 1.8, before: 2, after: 10 },
  { key: 'relaxed', label: '넓게', line: 2, before: 4, after: 12 },
  { key: 'double', label: '두 줄 간격', line: 2.2, before: 6, after: 14 },
]

/** 효과 — 문서 안 개체(도형·표·그림)에 함께 걸리는 마감 (워드 「효과」) */
export const DESIGN_EFFECTS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'flat', label: '평면', hint: '그림자 없이 또렷하게' },
  { key: 'soft', label: '부드러운 그림자', hint: '살짝 떠 보이게' },
  { key: 'sharp', label: '또렷한 그림자', hint: '인쇄물에서 대비가 큼' },
  { key: 'outline', label: '테두리 강조', hint: '선을 굵게, 그림자 없음' },
  { key: 'round', label: '둥근 모서리', hint: '모서리를 크게 굴린다' },
]

/** 페이지 테두리 — 워드 「페이지 테두리」 */
export const PAGE_BORDER_STYLES: Array<{ key: string; label: string }> = [
  { key: 'none', label: '없음' },
  { key: 'solid', label: '실선' },
  { key: 'double', label: '겹선' },
  { key: 'dashed', label: '파선' },
  { key: 'dotted', label: '점선' },
  { key: 'groove', label: '홈' },
  { key: 'ridge', label: '두둑' },
  { key: 'shadowbox', label: '그림자 상자' },
]

/** 쪽 색 — 워드 「페이지 색」 (인쇄 잉크를 아끼려 옅은 색만 고른다) */
export const PAGE_COLORS: Array<{ key: string; label: string; css: string }> = [
  { key: 'white', label: '흰색', css: '#ffffff' },
  { key: 'ivory', label: '아이보리', css: '#fdfaf3' },
  { key: 'cream', label: '크림', css: '#fbf6e9' },
  { key: 'mint', label: '민트', css: '#f2faf6' },
  { key: 'sky', label: '하늘', css: '#f3f8fd' },
  { key: 'rose', label: '연분홍', css: '#fdf4f5' },
  { key: 'gray', label: '연회색', css: '#f6f7f9' },
  { key: 'sepia', label: '세피아', css: '#f6efe2' },
]

export interface DocDesign {
  styleSet: string
  themeColor: string
  themeFont: string
  paraSpacing: string
  effect: string
  pageColor: string
  pageBorder: { style: string; color: string; width: number; padding: number; first: boolean }
  watermark: { text: string; color: string; opacity: number; angle: number; size: number }
}

export const DEFAULT_DESIGN: DocDesign = {
  styleSet: 'basic',
  themeColor: 'office',
  themeFont: 'default',
  paraSpacing: 'none',
  effect: 'flat',
  pageColor: 'white',
  pageBorder: { style: 'none', color: '#1c1f26', width: 1, padding: 12, first: true },
  watermark: { text: '', color: '#9aa4b2', opacity: 18, angle: -30, size: 64 },
}

export function styleSet(key: string): StyleSet {
  return STYLE_SETS.find((s) => s.key === key) || STYLE_SETS[0]
}
export function themeColorSet(key: string): ThemeColor {
  return THEME_COLORS.find((t) => t.key === key) || THEME_COLORS[0]
}
export function themeFontSet(key: string): ThemeFont {
  return THEME_FONTS.find((t) => t.key === key) || THEME_FONTS[0]
}

/**
 * 고른 디자인을 화면(그리고 인쇄)에 입힌다 — CSS 변수와 몇 개의 표시용 속성으로.
 * 문서 내용은 건드리지 않는다: 같은 글이 디자인만 갈아입는다 (워드와 같은 방식).
 */
export function applyDesign(design: DocDesign, root: HTMLElement = document.documentElement): void {
  const set = styleSet(design.styleSet)
  const theme = themeColorSet(design.themeColor)
  const fonts = themeFontSet(design.themeFont)
  const spacing = PARA_SPACING_SETS.find((p) => p.key === design.paraSpacing) || PARA_SPACING_SETS[0]
  const page = PAGE_COLORS.find((p) => p.key === design.pageColor) || PAGE_COLORS[0]

  const headFont = fonts.key === 'default' ? set.headFont : fonts.head
  const bodyFont = fonts.key === 'default' ? set.bodyFont : fonts.body
  const stack = (f: string) => (f === 'serif'
    ? "'Noto Serif KR', 'Nanum Myeongjo', 'Batang', serif"
    : f === 'mono' ? "'D2Coding', 'Consolas', 'Noto Sans Mono', monospace"
      : "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif")

  const style = root.style
  style.setProperty('--jan-doc-head-font', stack(headFont))
  style.setProperty('--jan-doc-body-font', stack(bodyFont))
  /* 편집기 본문 글꼴은 이 변수를 !important 로 쓰므로, 맞서지 말고 같은 변수를 채운다 */
  style.setProperty('--jan-editor-font', stack(bodyFont))
  style.setProperty('--jan-doc-body-size', `${set.bodySize}px`)
  style.setProperty('--jan-doc-line', String(design.paraSpacing === 'none' ? set.lineHeight : spacing.line))
  style.setProperty('--jan-doc-para-before', `${design.paraSpacing === 'none' ? 0 : spacing.before}px`)
  style.setProperty('--jan-doc-para-after', `${design.paraSpacing === 'none' ? set.paraSpacing : spacing.after}px`)
  style.setProperty('--jan-doc-indent', `${set.indent}em`)
  style.setProperty('--jan-doc-align', set.align)
  /* 첫 줄 들여쓰기·본문 정렬은 편집기가 이미 제 변수로 쓰고 있다 — 같은 변수를 채워 준다 */
  style.setProperty('--jan-editor-indent', `${set.indent}em`)
  style.setProperty('--jan-editor-align', set.align)
  style.setProperty('--jan-doc-head-scale', String(set.headScale))
  style.setProperty('--jan-doc-head-weight', String(set.headWeight))
  style.setProperty('--jan-doc-head-space', `${set.headSpaceBefore}px`)
  style.setProperty('--jan-doc-head-color', set.headTinted ? theme.colors[0] : 'inherit')
  style.setProperty('--jan-doc-head-case', set.headCase === 'upper' ? 'uppercase' : 'none')
  style.setProperty('--jan-doc-page-color', page.css)
  theme.colors.forEach((c, i) => style.setProperty(`--jan-theme-${i + 1}`, c))
  style.setProperty('--jan-doc-accent', theme.colors[0])

  const border = design.pageBorder
  style.setProperty('--jan-doc-border-style', border.style === 'none' ? 'none' : border.style === 'shadowbox' ? 'solid' : border.style)
  style.setProperty('--jan-doc-border-color', border.color)
  style.setProperty('--jan-doc-border-width', `${border.width}px`)
  style.setProperty('--jan-doc-border-pad', `${border.padding}px`)
  style.setProperty('--jan-doc-border-shadow', border.style === 'shadowbox' ? '4px 4px 0 rgba(0,0,0,0.25)' : 'none')

  root.setAttribute('data-jan-head-rule', set.headRule)
  root.setAttribute('data-jan-effect', design.effect)
  root.setAttribute('data-jan-page-border', design.pageBorder.style === 'none' ? 'off' : 'on')
  root.setAttribute('data-jan-border-first', design.pageBorder.first ? 'on' : 'off')
}

/** 워터마크 그림 — 쪽 배경에 깔 SVG (워드 「워터마크」) */
export function watermarkSvgOf(mark: DocDesign['watermark'], pageW: number, pageH: number): string {
  if (!mark.text.trim()) return ''
  const esc = mark.text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as Record<string, string>)[c])
  const color = /^#[0-9a-f]{3,8}$/i.test(mark.color) ? mark.color : '#9aa4b2'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}">
    <text x="${pageW / 2}" y="${pageH / 2}" text-anchor="middle" dominant-baseline="middle"
      transform="rotate(${mark.angle} ${pageW / 2} ${pageH / 2})"
      font-size="${mark.size}" font-weight="700" fill="${color}" fill-opacity="${Math.max(0, Math.min(100, mark.opacity)) / 100}">${esc}</text>
  </svg>`
}
