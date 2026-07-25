/**
 * Phase 14 — PDF 가져오기.
 * pdf.js (CDN) lazy → 페이지 텍스트 추출 → HTML 단락 변환 → 메모 삽입.
 */
const PDF_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs'
const WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs'


/** pdf.js 를 CDN 에서 불러 쓰는 만큼만 타입을 둔다 */
interface PdfJsLike {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (src: { data: ArrayBuffer } | string) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>
    }>
  }
}

let pdfjsLib: PdfJsLike | null = null

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = (await import(/* @vite-ignore */ PDF_CDN)) as unknown as PdfJsLike
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN
  return pdfjsLib
}

export interface PdfImportResult {
  pageCount: number
  html: string
}

export async function pdfFileToHtml(file: File, onProgress?: (p: number) => void): Promise<PdfImportResult> {
  const pdfjs = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const total = pdf.numPages
  const parts: string[] = []
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((it) => (it as { str?: string }).str ?? '')
      .filter((s: string) => s.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
    parts.push(`<h2>페이지 ${i}</h2><p>${escapeHtml(pageText)}</p>`)
    onProgress?.(i / total)
  }
  return {
    pageCount: total,
    html: parts.join('\n'),
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
