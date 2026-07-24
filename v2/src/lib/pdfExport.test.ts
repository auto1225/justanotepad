import { describe, expect, it } from 'vitest'
import { buildPrintHtml, currentPrintPageSettings, type PrintPageSettings } from './pdfExport'
import { useUIStore } from '../store/uiStore'
import { useTypographyStore } from '../store/typographyStore'

const landscapeGrid: PrintPageSettings = {
  paperStyle: 'grid',
  pageSize: 'Letter',
  pageOrientation: 'landscape',
  pageMarginMm: 12,
  pageMarginsMm: { top: 12, right: 12, bottom: 12, left: 12 },
  pageColumnCount: 1,
}

describe('pdfExport print document', () => {
  it('uses the requested page size, orientation, and margin', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', landscapeGrid)

    expect(out).toContain('@page { size: 279mm 216mm; margin: 12mm 12mm 12mm 12mm;')
    expect(out).toContain('data-paper="grid"')
    expect(out).toContain('repeating-linear-gradient(to right, transparent 0, transparent 19px')
  })

  it('prints individual Word-style page margins', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      pageMarginMm: 16,
      pageMarginsMm: { top: 10, right: 12, bottom: 14, left: 16 },
    })

    expect(out).toContain('@page { size: 279mm 216mm; margin: 10mm 12mm 14mm 16mm;')
  })

  it('keeps blank paper visually blank', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      paperStyle: 'blank',
    })

    expect(out).toContain('data-paper="blank"')
    expect(out).toContain('background-image:none')
  })

  it('escapes title contexts and can omit the preview header for PDF export', () => {
    const out = buildPrintHtml('<p>Hello</p>', '<Memo "One">', landscapeGrid, {
      includeHeaderTitle: false,
    })

    expect(out).toContain('<title>&lt;Memo &quot;One&quot;&gt;</title>')
    expect(out).not.toContain('@top-right')
  })

  it('uses running header and footer templates from page settings', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      runningHeader: '프로젝트 헤더',
      runningFooter: 'Page {page} / {total}',
    })

    expect(out).toContain('@top-left { content: "프로젝트 헤더";')
    expect(out).toContain('@bottom-right { content: "Page " counter(page) " / " counter(pages);')
  })

  it('keeps manual page breaks and typography settings in print output', () => {
    const out = buildPrintHtml('<p>One</p><hr class="jan-page-break" data-page-break="1" /><p>Two</p>', 'Memo', {
      ...landscapeGrid,
      fontFamily: 'serif',
      fontSize: 16,
      lineHeight: 1.9,
      paragraphSpacing: 12,
    })

    expect(out).toContain('font-family:"Noto Serif KR"')
    expect(out).toContain('font-size:12pt;line-height:1.9')
    expect(out).toContain('p{margin:0 0 12px;}')
    expect(out).toContain('.jan-page-break,hr.jan-page-break')
  })

  it('prints Word-like multi-column page layouts', () => {
    const out = buildPrintHtml('<h1>Title</h1><p>Body</p>', 'Memo', {
      ...landscapeGrid,
      pageColumnCount: 2,
    })

    expect(out).toContain('data-columns="2"')
    expect(out).toContain('#content{column-count:2;column-gap:7mm;')
    expect(out).toContain('break-inside:avoid-column')
  })

  it('prints custom paper sizes', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      pageSize: 'custom',
      pageOrientation: 'portrait',
      customPageWidthMm: 160,
      customPageHeightMm: 240,
    })

    expect(out).toContain('@page { size: 160mm 240mm;')
  })

  it('adds gutter (binding margin) to the chosen side', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      gutterMm: 10,
      gutterPosition: 'left',
    })

    expect(out).toContain('margin: 12mm 12mm 12mm 22mm;')
  })

  it('formats page numbers and start offset like Word', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      runningFooter: 'Page {page} / {total}',
      pageNumberFormat: 'dash',
      pageNumberStart: 5,
    })

    expect(out).toContain('"- " counter(page) " -"')
    expect(out).toContain('#content{counter-reset: page 4;}')
  })

  it('supports roman numeral page numbers', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      runningFooter: '{page}',
      pageNumberFormat: 'lowerRoman',
    })

    expect(out).toContain('counter(page, lower-roman)')
  })

  it('hides running header and footer on the first page when requested', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      runningFooter: 'Page {page}',
      firstPageRunningOff: true,
    })

    expect(out).toContain('@page :first { @top-left { content: none; }')
  })

  it('stamps a diagonal watermark on every printed page', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      watermarkText: '대외비',
    })

    expect(out).toContain('.pagedjs_page::after')
    expect(out).toContain('data:image/svg+xml')
  })

  it('applies orphan/widow control and keep rules for print typesetting', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', landscapeGrid)

    expect(out).toContain('p,li{orphans:2;widows:2;}')
    expect(out).toContain('h1,h2,h3{break-after:avoid;}')
    expect(out).toContain('table,figure,pre,blockquote,img{break-inside:avoid;}')
  })

  it('reads current settings from uiStore', () => {
    useUIStore.setState({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
      pageMarginsMm: { top: 10, right: 12, bottom: 14, left: 16 },
      pageColumnCount: 3,
      runningHeader: '헤더',
      runningFooter: '쪽 {page}',
    })
    useTypographyStore.setState({
      fontFamily: 'mono',
      fontSize: 13,
      lineHeight: 1.55,
      paragraphSpacing: 6,
    })

    expect(currentPrintPageSettings()).toMatchObject({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
      pageMarginsMm: { top: 10, right: 12, bottom: 14, left: 16 },
      pageColumnCount: 3,
      runningHeader: '헤더',
      runningFooter: '쪽 {page}',
      fontFamily: 'mono',
      fontSize: 13,
    })
  })
})
