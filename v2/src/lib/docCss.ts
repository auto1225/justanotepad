/**
 * 내보낸 문서(HTML·Word)에 함께 넣는 서식.
 *
 * 앱 화면에서 본 문서와 파일로 열었을 때의 문서가 같아야 한다 —
 * 스타일을 빼면 브라우저 기본값으로 떨어져 제목 크기·표 격자·인용선이 모두 사라진다.
 * 화면 쪽 규칙(index.css 의 문서 본문 서식)과 값을 맞춰 둔다.
 */
export const DOC_EXPORT_CSS = `
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 11pt; line-height: 1.65; color: #191919; max-width: 210mm; margin: 20mm auto; padding: 0 22mm; }
  p { margin: 0.5em 0; }
  h1, h2, h3, h4, h5, h6 { font-weight: 700; margin: 1em 0 0.3em; line-height: 1.35; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; } h5, h6 { font-size: 1em; }
  a { color: #1565C0; text-decoration: underline; }
  mark { background: #ffff00; }
  ul { list-style: disc; padding-left: 24px; }
  ol { list-style: decimal; padding-left: 24px; }
  ul[data-type="taskList"] { list-style: none; padding-left: 8px; }
  table { border-collapse: collapse; }
  table td, table th { border: 1px solid #9aa1ab; padding: 5px 8px; vertical-align: top; }
  table th { background: #f0f2f5; font-weight: 600; text-align: center; }
  img { max-width: 100%; height: auto; }
  blockquote { margin: 0.7em 0; padding: 2px 0 2px 14px; border-left: 3px solid #d97757; color: #555; }
  pre { margin: 0.7em 0; padding: 10px 12px; background: #f4f4f2; border: 1px solid #e2e2de; border-radius: 6px; font-family: Consolas, 'D2Coding', 'Courier New', monospace; font-size: 0.92em; line-height: 1.55; overflow-x: auto; }
  pre code { background: none; padding: 0; font: inherit; }
  code { background: #f0f0ee; padding: 1px 4px; border-radius: 3px; font-family: Consolas, 'D2Coding', 'Courier New', monospace; font-size: 0.92em; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 1.2em 0; }
`
