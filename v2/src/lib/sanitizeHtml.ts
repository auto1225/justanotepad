/**
 * 외부(제3자) HTML 살균 — dangerouslySetInnerHTML 등으로 렌더링하기 전에 반드시 통과시킬 것.
 * <script> 제거만으로는 부족하다: <img onerror=...>, <svg onload=...>, javascript: URL 이
 * 앱 origin 에서 실행되어 localStorage 의 API 키까지 접근할 수 있다.
 * 구현은 DOMPurify (mXSS·SVG 네임스페이스 트릭까지 방어).
 */
import DOMPurify from 'dompurify'

/** 신뢰할 수 없는 HTML 문자열 → 살균된 HTML 문자열. */
export function sanitizeUntrustedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'base', 'link', 'meta'],
    FORBID_ATTR: ['formaction'],
  })
}

export function escapeHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
