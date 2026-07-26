import type { Editor } from '@tiptap/react'
import { useUIStore, type MemoPageSettings } from '../store/uiStore'
import { useTypographyStore, type TypographySettings } from '../store/typographyStore'
import { flash } from './flash'

/**
 * 글로벌 논문 표준 양식 프리셋 — 실제 투고 규정 실측치 기반.
 *  - IEEE 컨퍼런스: A4 2단, 여백 19mm, 본문 Times 10pt, 제목 24pt
 *  - APA 7판: Letter 1단, 여백 25mm(1in), 12pt 더블스페이스, 표지+Abstract
 *  - Springer LNCS: A4 1단, 텍스트영역 122×193mm(여백 좌우44/상하52), 10pt, 제목 16pt
 *  - Elsevier 심사 원고: A4 1단, 25mm, 12pt 더블스페이스
 *  - 학위논문(글로벌): A4 1단, 상30/좌30(+제본여백)/우하25, 12pt 1.9
 * pt→px 는 96dpi 기준(1pt=1.333px)으로 환산.
 */
export interface PaperFormatDef {
  key: string
  label: string
  desc: string
  page: Partial<MemoPageSettings>
  typo: TypographySettings
  skeleton: string
}

const pt = (n: number) => `${n}pt`

function ieeeSkeleton(): string {
  return [
    `<h1 style="text-align:center"><span style="font-size:${pt(24)}">Paper Title Here</span></h1>`,
    `<p data-paper-block="titleblock" style="text-align:center"><span style="font-size:${pt(11)}">First Author, Second Author, Third Author</span></p>`,
    `<p data-paper-block="titleblock" style="text-align:center"><span style="font-size:${pt(10)}"><em>Department, University, City, Country · email@example.com</em></span></p>`,
    `<p><strong><em><span style="font-size:${pt(9)}">Abstract—</span></em></strong><em><span style="font-size:${pt(9)}">This paper presents ... (150~250 words)</span></em></p>`,
    `<p><strong><em><span style="font-size:${pt(9)}">Index Terms—</span></em></strong><em><span style="font-size:${pt(9)}">keyword one, keyword two, keyword three</span></em></p>`,
    '<h2>I. Introduction</h2><p></p>',
    '<h2>II. Related Work</h2><p></p>',
    '<h2>III. Method</h2><p></p>',
    '<h2>IV. Experiments</h2><p></p>',
    '<h2>V. Conclusion</h2><p></p>',
    '<h2>References</h2><p></p>',
  ].join('')
}

function apaSkeleton(): string {
  return [
    '<p></p><p></p><p></p>',
    '<h1 style="text-align:center">Title of the Paper: Subtitle if Needed</h1>',
    '<p style="text-align:center">Author Name</p>',
    '<p style="text-align:center">Department, University</p>',
    '<p style="text-align:center">Course · Instructor · Date</p>',
    '<hr class="jan-page-break" data-page-break="1" />',
    '<h2 style="text-align:center">Abstract</h2>',
    '<p>One paragraph, no indent, 250 words or fewer summarizing the problem, method, results, and conclusions.</p>',
    '<p><em>Keywords:</em> keyword one, keyword two, keyword three</p>',
    '<hr class="jan-page-break" data-page-break="1" />',
    '<h2>Introduction</h2><p></p>',
    '<h2>Method</h2><p></p>',
    '<h2>Results</h2><p></p>',
    '<h2>Discussion</h2><p></p>',
    '<h2 style="text-align:center">References</h2><p></p>',
  ].join('')
}

function lncsSkeleton(): string {
  return [
    `<h1 style="text-align:center"><span style="font-size:${pt(16)}">Contribution Title</span></h1>`,
    `<p style="text-align:center"><span style="font-size:${pt(11)}">First Author¹ · Second Author²</span></p>`,
    `<p style="text-align:center"><span style="font-size:${pt(9)}">¹ Institute, City, Country &nbsp;² University, City, Country</span></p>`,
    `<p><strong><span style="font-size:${pt(9)}">Abstract.</span></strong> <span style="font-size:${pt(9)}">The abstract should summarize the contents in 150–250 words.</span></p>`,
    `<p><strong><span style="font-size:${pt(9)}">Keywords:</span></strong> <span style="font-size:${pt(9)}">First keyword · Second keyword · Third keyword</span></p>`,
    '<h2>1&nbsp;&nbsp;Introduction</h2><p></p>',
    '<h2>2&nbsp;&nbsp;Background</h2><p></p>',
    '<h2>3&nbsp;&nbsp;Approach</h2><p></p>',
    '<h2>4&nbsp;&nbsp;Evaluation</h2><p></p>',
    '<h2>5&nbsp;&nbsp;Conclusion</h2><p></p>',
    '<h2>References</h2><p></p>',
  ].join('')
}

function elsevierSkeleton(): string {
  return [
    '<h1>Article Title</h1>',
    '<p>Author One<sup>a</sup>, Author Two<sup>b</sup></p>',
    '<p><em><sup>a</sup> Affiliation One · <sup>b</sup> Affiliation Two</em></p>',
    '<h2 style="text-align:left">Abstract</h2>',
    '<p>Structured or unstructured abstract, typically 100–300 words.</p>',
    '<p><em>Keywords:</em> keyword; keyword; keyword</p>',
    '<h2>1. Introduction</h2><p></p>',
    '<h2>2. Materials and methods</h2><p></p>',
    '<h2>3. Results</h2><p></p>',
    '<h2>4. Discussion</h2><p></p>',
    '<h2>5. Conclusions</h2><p></p>',
    '<h2>Acknowledgments</h2><p></p>',
    '<h2>References</h2><p></p>',
  ].join('')
}

function thesisSkeleton(): string {
  return [
    '<p></p><p></p>',
    '<h1 style="text-align:center">Thesis Title</h1>',
    '<p style="text-align:center">by</p>',
    '<p style="text-align:center">Author Name</p>',
    '<p style="text-align:center">A thesis submitted for the degree of ...</p>',
    '<p style="text-align:center">Department · University · Year</p>',
    '<hr class="jan-page-break" data-page-break="1" />',
    '<h2 style="text-align:center">Abstract</h2><p></p>',
    '<hr class="jan-page-break" data-page-break="1" />',
    '<h1>Chapter 1. Introduction</h1><p></p>',
    '<h1>Chapter 2. Literature Review</h1><p></p>',
    '<h1>Chapter 3. Methodology</h1><p></p>',
    '<h1>Chapter 4. Results</h1><p></p>',
    '<h1>Chapter 5. Conclusion</h1><p></p>',
    '<h1>References</h1><p></p>',
  ].join('')
}

export const PAPER_FORMATS: PaperFormatDef[] = [
  {
    key: 'ieee',
    label: 'IEEE 컨퍼런스 (2단)',
    desc: 'A4 · 여백 19mm · 2단 · Times 10pt · 제목 24pt',
    page: {
      pageSize: 'A4', pageOrientation: 'portrait',
      pageMarginsMm: { top: 19, right: 19, bottom: 19, left: 19 }, pageMarginMm: 19,
      pageColumnCount: 2, paperStyle: 'blank',
      runningFooter: '', runningHeader: '',
    },
    typo: { fontFamily: 'serif', fontSize: 13, lineHeight: 1.15, paragraphSpacing: 0, letterSpacing: -1, charScale: 100, textIndent: 1, align: 'justify' },
    skeleton: ieeeSkeleton(),
  },
  {
    key: 'apa7',
    label: 'APA 7판',
    desc: 'Letter · 여백 1in(25mm) · 12pt 더블스페이스 · 표지+Abstract',
    page: {
      pageSize: 'Letter', pageOrientation: 'portrait',
      pageMarginsMm: { top: 25, right: 25, bottom: 25, left: 25 }, pageMarginMm: 25,
      pageColumnCount: 1, paperStyle: 'blank',
      runningHeader: '', runningFooter: '{page}',
      pageNumberFormat: 'arabic', firstPageRunningOff: false,
    },
    typo: { fontFamily: 'serif', fontSize: 16, lineHeight: 2.0, paragraphSpacing: 0, letterSpacing: 0, charScale: 100, textIndent: 0.5, align: 'left' },
    skeleton: apaSkeleton(),
  },
  {
    key: 'lncs',
    label: 'Springer LNCS',
    desc: 'A4 · 텍스트영역 122×193mm · Times 10pt · 제목 16pt',
    page: {
      pageSize: 'A4', pageOrientation: 'portrait',
      pageMarginsMm: { top: 52, right: 44, bottom: 52, left: 44 }, pageMarginMm: 48,
      pageColumnCount: 1, paperStyle: 'blank',
      runningHeader: '', runningFooter: '',
    },
    typo: { fontFamily: 'serif', fontSize: 13, lineHeight: 1.35, paragraphSpacing: 0, letterSpacing: -0.5, charScale: 100, textIndent: 1, align: 'justify' },
    skeleton: lncsSkeleton(),
  },
  {
    key: 'elsevier',
    label: 'Elsevier 심사 원고',
    desc: 'A4 · 여백 25mm · 12pt 더블스페이스 · 1단 매뉴스크립트',
    page: {
      pageSize: 'A4', pageOrientation: 'portrait',
      pageMarginsMm: { top: 25, right: 25, bottom: 25, left: 25 }, pageMarginMm: 25,
      pageColumnCount: 1, paperStyle: 'blank',
      runningHeader: '', runningFooter: 'Page {page} / {total}',
    },
    typo: { fontFamily: 'serif', fontSize: 16, lineHeight: 2.0, paragraphSpacing: 6, letterSpacing: 0, charScale: 100, textIndent: 0.5, align: 'left' },
    skeleton: elsevierSkeleton(),
  },
  {
    key: 'thesis',
    label: '학위논문 (Thesis)',
    desc: 'A4 · 상30/좌30(+제본 10mm)/우하25 · 12pt 1.9 · 챕터 구조',
    page: {
      pageSize: 'A4', pageOrientation: 'portrait',
      pageMarginsMm: { top: 30, right: 25, bottom: 25, left: 30 }, pageMarginMm: 28,
      pageColumnCount: 1, paperStyle: 'blank',
      gutterMm: 10, gutterPosition: 'left',
      runningHeader: '', runningFooter: '{page}',
      pageNumberFormat: 'arabic', firstPageRunningOff: true,
    },
    typo: { fontFamily: 'serif', fontSize: 16, lineHeight: 1.9, paragraphSpacing: 8, letterSpacing: 0, charScale: 100, textIndent: 1, align: 'justify' },
    skeleton: thesisSkeleton(),
  },
]

/** 양식 적용 — 골격 삽입 → 타이포 → (자동저장 여유 후) 페이지 설정.
 * 다단 전환은 에디터를 재생성하므로, 골격이 자동저장(350ms)으로
 * 커밋된 뒤에 페이지 설정을 적용해야 내용이 유실되지 않는다. */
export function applyPaperFormat(editor: Editor | null, key: string, withSkeleton = true): void {
  const fmt = PAPER_FORMATS.find((f) => f.key === key)
  if (!fmt) return
  if (withSkeleton && editor && !editor.isDestroyed) {
    editor.chain().focus('start').insertContentAt(0, fmt.skeleton).run()
  }
  useUIStore.getState().setPaperFormat(fmt.key)
  const typo = useTypographyStore.getState()
  typo.setFontFamily(fmt.typo.fontFamily)
  typo.setFontSize(fmt.typo.fontSize)
  typo.setLineHeight(fmt.typo.lineHeight)
  typo.setParagraphSpacing(fmt.typo.paragraphSpacing)
  // 본문 조판(정렬·첫 줄 들여쓰기·자간·장평)도 양식의 일부다 — 규정대로 함께 적용한다
  typo.setAlign(fmt.typo.align)
  typo.setTextIndent(fmt.typo.textIndent)
  typo.setLetterSpacing(fmt.typo.letterSpacing)
  typo.setCharScale(fmt.typo.charScale)
  window.setTimeout(() => {
    useUIStore.getState().applyPageSettings(fmt.page)
  }, withSkeleton ? 600 : 0)
  flash(`${fmt.label} 양식 적용 — ${fmt.desc}`)
}
