/**
 * 붙여넣은 글에서 글꼴만 벗긴다.
 *
 * 왜 여기서 벗기는가 —
 * 워드나 웹에서 베껴 온 글은 <span style="font-family:Arial"> 을 달고 들어온다.
 * 그런데 사람이 글꼴 고르개로 일부러 고른 글꼴도 똑같이 인라인 font-family 로 남는다.
 * 마크가 되고 나면 둘은 생김새가 같아 무엇이 사람 뜻이었는지 가릴 길이 없다.
 * 가를 수 있는 자리는 「들어오는 문」 하나뿐이라, 붙여넣기 그 순간에 벗긴다.
 *
 * 예전에는 이 일을 CSS 가 대신했다. 편집기 안 모든 요소의 font-family 를
 * !important 로 못 박아 붙여 온 글꼴을 눌렀는데, 그 그물이 너무 넓어
 * 사람이 일부러 고른 글꼴까지 함께 눌러 버렸다 (화면에 전혀 나타나지 않았다).
 * 문에서 벗기면 살아남은 인라인 글꼴은 곧 사람 뜻이므로, CSS 가 힘으로 누를 일이 없다.
 *
 * 우리 편집기끼리 주고받은 글은 건드리지 않는다 — ProseMirror 가 제 클립보드에
 * data-pm-slice 를 달아 두므로 그것으로 알아본다. 그래야 고른 글꼴이 붙은 글을
 * 베껴 다른 자리에 붙여도 글꼴이 따라간다 (워드와 같은 차례다).
 */
export function stripPastedFontFamily(html: string): string {
  if (!html) return html
  /* 우리 쪽에서 베껴 온 글 — 사람이 고른 글꼴이 담겨 있으므로 그대로 둔다 */
  if (html.includes('data-pm-slice')) return html
  if (!/font-family/i.test(html)) return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('[style]'))) {
    if (!el.style.fontFamily) continue
    el.style.removeProperty('font-family')
    /* 글꼴 하나뿐이던 style 은 빈 껍데기로 남기지 않는다 */
    if (!el.getAttribute('style')?.trim()) el.removeAttribute('style')
  }
  return doc.body.innerHTML
}
