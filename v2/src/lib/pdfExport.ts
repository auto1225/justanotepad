import { resolveBlobRefsInHtml } from './blobRefs'
import {
  DEFAULT_RUNNING_FOOTER,
  pageMarginsCss,
  pageDimensions,
  useUIStore,
  type PageOrientation,
  type PageColumnCount,
  type PageMarginsMm,
  type PageSizePreset,
  type PaperStyle,
} from '../store/uiStore'
import { getTypographyFontStack, useTypographyStore, type FontFamily } from '../store/typographyStore'

const PAGED_CDN = 'https://unpkg.com/pagedjs/dist/paged.polyfill.js'

// Paged.js 를 로컬 번들에서 인라인 주입 — CDN 이 막힌 환경(오프라인·사내망)에서
// 인쇄 미리보기가 조용히 0페이지가 되던 문제의 근본 해결. 동적 import 라 코드 스플릿됨.
let pagedSourceCache: string | null = null
export async function getPagedSource(): Promise<string | null> {
  if (pagedSourceCache) return pagedSourceCache
  try {
    // pagedjs 의 exports 맵에 서브패스가 없어 패키지 경로로는 접근 불가 — 상대 경로로 raw 로드
    const mod = await import('../../node_modules/pagedjs/dist/paged.polyfill.js?raw')
    pagedSourceCache = mod.default
    return pagedSourceCache
  } catch {
    return null
  }
}

export interface PrintPageSettings {
  paperStyle: PaperStyle
  pageSize: PageSizePreset
  pageOrientation: PageOrientation
  pageMarginMm: number
  pageMarginsMm?: PageMarginsMm
  pageColumnCount?: PageColumnCount
  runningHeader?: string
  runningFooter?: string
  fontFamily?: FontFamily
  fontSize?: number
  lineHeight?: number
  paragraphSpacing?: number
}

export function currentPrintPageSettings(): PrintPageSettings {
  const ui = useUIStore.getState()
  const typography = useTypographyStore.getState()
  return {
    paperStyle: ui.paperStyle,
    pageSize: ui.pageSize,
    pageOrientation: ui.pageOrientation,
    pageMarginMm: ui.pageMarginMm,
    pageMarginsMm: ui.pageMarginsMm,
    pageColumnCount: ui.pageColumnCount,
    runningHeader: ui.runningHeader,
    runningFooter: ui.runningFooter,
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
    paragraphSpacing: typography.paragraphSpacing,
  }
}

export async function exportToPdf(html: string, title: string): Promise<void> {
  // jan-blob:// 이미지 참조 해석 — 인쇄 iframe 은 이 스킴을 읽지 못한다
  html = await resolveBlobRefsInHtml(html)
  const settings = currentPrintPageSettings()
  const page = pageDimensions(settings.pageSize, settings.pageOrientation)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = `${page.widthMm}mm`
  iframe.style.height = `${page.heightMm}mm`
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)
  iframe.srcdoc = buildPrintHtml(html, title, settings, { includeHeaderTitle: false, pagedSource: await getPagedSource() })

  await new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.warn('[pdfExport] print failed', e)
        }
        const cleanup = () => {
          try { document.body.removeChild(iframe) } catch {
            // The iframe may already be removed if the browser fires afterprint twice.
          }
          resolve()
        }
        iframe.contentWindow?.addEventListener('afterprint', cleanup)
        setTimeout(cleanup, 30000)
      }, 1500)
    })
  })
}

interface BuildPrintHtmlOptions {
  includeHeaderTitle?: boolean
  previewChrome?: boolean
  /** Paged.js 소스를 인라인 주입 (CDN 의존 제거) */
  pagedSource?: string | null
}

export function buildPrintHtml(
  html: string,
  title: string,
  settings: PrintPageSettings = currentPrintPageSettings(),
  options: BuildPrintHtmlOptions = {}
): string {
  const titleAttr = escAttr(title)
  const titleCss = escCss(title)
  const page = pageDimensions(settings.pageSize, settings.pageOrientation)
  const pageSizeCss = `${page.widthMm}mm ${page.heightMm}mm`
  const marginCss = pageMarginsCss(settings.pageMarginsMm, settings.pageMarginMm)
  const runningHeader = settings.runningHeader?.trim() || ''
  const runningFooter = settings.runningFooter?.trim() || DEFAULT_RUNNING_FOOTER
  const headerCss = runningHeader
    ? `@top-left { content: ${cssContentFromTemplate(runningHeader)}; font-size: 9pt; color:#666; }`
    : options.includeHeaderTitle === false
      ? ''
      : `@top-right { content: "${titleCss}"; font-size: 9pt; color:#888; }`
  const footerCss = runningFooter
    ? `@bottom-right { content: ${cssContentFromTemplate(runningFooter)}; font-size:9pt; color:#888; }`
    : ''
  const previewCss = options.previewChrome
    ? 'body{background:#ccc;}.pagedjs_page{margin:16px auto !important;box-shadow:0 4px 16px rgba(0,0,0,0.18);}'
    : 'body{background:#fff;}'
  const fontFamily = getTypographyFontStack(settings.fontFamily || 'sans')
  const fontSizePt = pxToPt(settings.fontSize || 14)
  const lineHeight = settings.lineHeight || 1.7
  const paragraphSpacing = Math.max(0, Math.round(settings.paragraphSpacing ?? 8))
  const pageColumnCount = normalizePrintColumnCount(settings.pageColumnCount)
  const columnCss = pageColumnCount > 1
    ? `#content{column-count:${pageColumnCount};column-gap:${pageColumnCount === 2 ? '7mm' : '5mm'};column-rule:1px solid rgba(0,0,0,0.08);}#content :where(h1,h2,h3,table,pre,blockquote,img,.jan-page-break,.tiptap-pagination-page-break){break-inside:avoid-column;}`
    : ''

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>${titleAttr}</title>
<style>
@page { size: ${pageSizeCss}; margin: ${marginCss};
  ${headerCss}
  ${footerCss}
}
html,body{margin:0;padding:0;}
body{font-family:${fontFamily};font-size:${fontSizePt}pt;line-height:${lineHeight};color:#222;}
body,#content,.pagedjs_page,.pagedjs_page_content{
  --jan-note-line: rgba(229,229,229,0.78);
  --jan-note-margin-line: rgba(217,119,87,0.5);
  background-color:#fff;
}
${paperBackgroundCss(settings.paperStyle)}
${previewCss}
h1{font-size:22pt;font-weight:700;margin:1em 0 0.5em;}
h2{font-size:17pt;font-weight:700;margin:1em 0 0.4em;}
h3{font-size:14pt;font-weight:600;margin:0.8em 0 0.3em;}
p{margin:0 0 ${paragraphSpacing}px;}
table{border-collapse:collapse;margin:0.6em 0;width:100%;}
th,td{border:1px solid #999;padding:4px 8px;}
th{background:#f0f0f0;font-weight:600;}
pre,code{font-family:"D2Coding",monospace;background:#f5f5f5;padding:0 4px;border-radius:3px;}
pre{padding:8px 12px;overflow-x:auto;}
blockquote{border-left:3px solid #D97757;padding:4px 12px;margin:0.6em 0;color:#555;background:rgba(217,119,87,0.05);}
img{max-width:100%;height:auto;}
.jan-page-break,hr.jan-page-break,[data-page-break="1"],div[style*="page-break-before"],.tiptap-pagination-page-break{break-before:page;page-break-before:always;height:0 !important;border:0 !important;margin:0 !important;background:transparent !important;overflow:hidden;}
${columnCss}
@media print{body{background:white;}.pagedjs_page{box-shadow:none !important;margin:0 !important;}}
</style></head><body data-paper="${settings.paperStyle}">
<div id="content" data-paper="${settings.paperStyle}" data-columns="${pageColumnCount}">${html}</div>
${options.pagedSource ? `<script>${options.pagedSource.replace(/<\/script/gi, '<\\/script')}</script>` : `<script src="${PAGED_CDN}"></script>`}
</body></html>`
}

function paperBackgroundCss(paperStyle: PaperStyle): string {
  const selector = `body[data-paper="${paperStyle}"],#content[data-paper="${paperStyle}"],body[data-paper="${paperStyle}"] .pagedjs_page,body[data-paper="${paperStyle}"] .pagedjs_page_content`
  switch (paperStyle) {
    case 'grid':
      return `${selector}{background-image:repeating-linear-gradient(to right, transparent 0, transparent 19px, var(--jan-note-line) 19px, var(--jan-note-line) 20px),repeating-linear-gradient(to bottom, transparent 0, transparent 19px, var(--jan-note-line) 19px, var(--jan-note-line) 20px);}`
    case 'dot':
      return `${selector}{background-image:radial-gradient(circle, var(--jan-note-line) 1px, transparent 1.5px);background-size:20px 20px;background-position:10px 18px;}`
    case 'blank':
      return `${selector}{background-image:none;}`
    case 'music':
      return `${selector}{background-image:repeating-linear-gradient(to bottom, transparent 0, transparent 34px, var(--jan-note-line) 34px, var(--jan-note-line) 35px, transparent 35px, transparent 42px, var(--jan-note-line) 42px, var(--jan-note-line) 43px, transparent 43px, transparent 50px, var(--jan-note-line) 50px, var(--jan-note-line) 51px, transparent 51px, transparent 58px, var(--jan-note-line) 58px, var(--jan-note-line) 59px, transparent 59px, transparent 66px, var(--jan-note-line) 66px, var(--jan-note-line) 67px, transparent 67px, transparent 110px);}`
    case 'cornell':
      return `${selector}{background-image:linear-gradient(to right, transparent 35%, var(--jan-note-line) 35%, var(--jan-note-line) calc(35% + 1px), transparent calc(35% + 1px)),repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--jan-note-line) 27px, var(--jan-note-line) 28px);background-position:0 0, 0 8px;}`
    case 'lined':
    default:
      return `${selector}{background-image:linear-gradient(to right, transparent 34px, var(--jan-note-margin-line) 34px, var(--jan-note-margin-line) 35px, transparent 35px),repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--jan-note-line) 27px, var(--jan-note-line) 28px);background-position:0 0, 0 8px;}`
  }
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escCss(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function cssContentFromTemplate(template: string): string {
  const parts: string[] = []
  const pattern = /\{page\}|\{total\}/g
  let lastIndex = 0
  for (const match of template.matchAll(pattern)) {
    if (match.index > lastIndex) parts.push(`"${escCss(template.slice(lastIndex, match.index))}"`)
    parts.push(match[0] === '{page}' ? 'counter(page)' : 'counter(pages)')
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < template.length) parts.push(`"${escCss(template.slice(lastIndex))}"`)
  return parts.length ? parts.join(' ') : '""'
}

function pxToPt(px: number): number {
  return Math.max(8, Math.round(px * 0.75 * 100) / 100)
}

function normalizePrintColumnCount(value: unknown): PageColumnCount {
  return value === 2 || value === 3 ? value : 1
}
