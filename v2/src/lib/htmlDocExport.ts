/**
 * HTML / Word(.doc) 파일 다운로드 헬퍼.
 * Toolbar 인라인 구현을 제목·내용을 받는 재사용 함수로 승격 — "모든 형식 내보내기"에서 공유.
 */

function safeFileName(title: string): string {
  return (title || '메모').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || '메모'
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 800)
}

export function downloadHtmlFile(bodyHtml: string, title: string): void {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title></head><body>${bodyHtml}</body></html>`
  triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeFileName(title)}.html`)
}

/** HTML 을 Word 가 인식하는 .doc (HTML application) 로 저장 — 가장 단순한 docx 호환 */
export function downloadDocFile(bodyHtml: string, title: string): void {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title></head><body>${bodyHtml}</body></html>`
  triggerDownload(new Blob(['﻿', html], { type: 'application/msword' }), `${safeFileName(title)}.doc`)
}
