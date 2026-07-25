/** 리본 버튼에 보일 짧은 이름 — 컴포넌트 파일에서 분리해 두어야 빠른 새로고침이 깨지지 않는다 */
export interface ShortLabelInput {
  label: string
  short?: string
}

/** 리본 버튼에 쓸 짧은 이름 — 괄호·부연 설명을 걷어내고 앞부분만 남긴다 */
export function shortLabel(item: ShortLabelInput): string {
  if (item.short) return item.short
  const MAX = 8
  let s = item.label
    .replace(/\([^)]*\)/g, ' ') // 괄호 설명
    .replace(/\s*[—·:]\s*.*$/, '') // 부연 설명
    .replace(/\s*\/\s*.*$/, '') // "잠금 / 비밀번호" → "잠금"
    .replace(/\.{2,}\s*$/, '') // 말줄임표
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > MAX) {
    const cut = s.slice(0, MAX)
    const sp = cut.lastIndexOf(' ')
    if (sp >= 3) s = cut.slice(0, sp)
    else {
      // 라틴 단어는 중간에서 자르면 못 알아본다 (Markdow…) — 단어 단위로 남긴다
      const word = s.match(/^[A-Za-z0-9.+-]+/)
      s = word && word[0].length <= 12 ? word[0] : cut
    }
  }
  return s || item.label
}

