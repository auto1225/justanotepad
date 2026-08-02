/**
 * 플래시카드로 뽑을 것을 문서에서 고른다.
 *
 * 지금까지는 제목을 앞면, 그 아래 글을 통째로 뒷면으로 삼았다. 강의 노트에서는 그 결과가
 * 나쁘다 — 「4. 핵심 개념」 을 앞면으로 하고 절 전체를 뒷면에 쏟아 놓으면 외울 것이 없다.
 *
 * 강의 노트에는 이미 외우라고 만든 자리가 있다.
 *   · 확인 문제 — 문제와 답이 짝지어 있다. 그대로 카드다.
 *   · 핵심 개념의 「정의 · 왜 필요한가 · 흔한 오해」 — 개념 이름을 물으면 된다.
 *   · 용어표 — 우리말 / 영어 / 뜻 이 나란한 표.
 * 그런 자리가 있으면 그것으로 카드를 만들고, 없을 때만 제목으로 만든다.
 */

export interface Card {
  q: string
  a: string
  /** 어디에서 뽑았나 — 사람에게 보여 주고, 시험에서도 확인한다 */
  from: 'quiz' | 'term' | 'concept' | 'heading'
}

const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()

/** 「답.」 「정답:」 처럼 답이 시작되는 자리를 찾는다 */
const ANSWER_MARK = /(답|정답|해설)\s*[.:·]\s*/

/** 줄바꿈 태그는 글자를 남기지 않는다 — 그대로 읽으면 「…속도는?답.」 처럼 붙어 버린다 */
function textOf(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' ')))
  return clean(copy.textContent)
}

/** 확인 문제 — <li> 안에 문제와 답이 함께 있는 꼴 */
function fromQuiz(root: ParentNode): Card[] {
  const cards: Card[] = []
  for (const li of Array.from(root.querySelectorAll('li'))) {
    const text = textOf(li)
    const m = ANSWER_MARK.exec(text)
    if (!m || m.index < 4) continue
    const q = text.slice(0, m.index).trim()
    const a = text.slice(m.index + m[0].length).trim()
    if (q.length < 4 || a.length < 2) continue
    cards.push({ q, a, from: 'quiz' })
  }
  return cards
}

/** 용어표 — 두 칸 이상인 표에서 첫 칸을 묻고 나머지를 답으로 */
function fromTerms(root: ParentNode): Card[] {
  const cards: Card[] = []
  for (const table of Array.from(root.querySelectorAll('table'))) {
    const head = clean(table.querySelector('thead')?.textContent)
    /* 용어 · 뜻 이 있는 표만 — 아무 표나 카드로 만들면 숫자표까지 외우게 된다 */
    if (!/용어|뜻|정의|영어|낱말|term/i.test(head)) continue
    for (const tr of Array.from(table.querySelectorAll('tbody tr'))) {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => clean(td.textContent))
      if (cells.length < 2 || !cells[0]) continue
      const a = cells.slice(1).filter(Boolean).join(' — ')
      if (!a) continue
      cards.push({ q: cells[0], a, from: 'term' })
    }
  }
  return cards
}

/** 핵심 개념 — 「정의.」 로 시작하는 문단을 가진 소제목 */
function fromConcepts(root: ParentNode): Card[] {
  const cards: Card[] = []
  for (const h of Array.from(root.querySelectorAll('h3, h4'))) {
    const parts: string[] = []
    let next = h.nextElementSibling
    while (next && !/^H[1-4]$/.test(next.tagName)) {
      const t = clean(next.textContent)
      if (/^(정의|왜 필요한가|흔한 오해)\s*[.:]/.test(t)) parts.push(t)
      next = next.nextElementSibling
    }
    if (!parts.length) continue
    /* 제목 앞의 번호는 떼고 묻는다 — 「4.2」 를 외울 일은 없다 */
    const q = clean(h.textContent).replace(/^\d+(\.\d+)*\.?\s*/, '')
    if (q) cards.push({ q, a: parts.join('\n'), from: 'concept' })
  }
  return cards
}

/** 아무 자리도 없을 때 — 예전처럼 제목과 그 아래 글 */
function fromHeadings(root: ParentNode): Card[] {
  const cards: Card[] = []
  for (const h of Array.from(root.querySelectorAll('h1, h2, h3'))) {
    let next = h.nextElementSibling
    let body = ''
    while (next && !/^H[1-3]$/.test(next.tagName)) { body += clean(next.textContent) + ' '; next = next.nextElementSibling }
    const q = clean(h.textContent)
    if (q) cards.push({ q, a: body.trim(), from: 'heading' })
  }
  return cards
}

/**
 * 문서에서 카드를 뽑는다. 외우라고 만든 자리를 먼저 보고, 없으면 제목으로 물러선다.
 */
export function makeCards(root: ParentNode): Card[] {
  const good = [...fromQuiz(root), ...fromConcepts(root), ...fromTerms(root)]
  /* 앞뒤가 같은 카드는 외울 것이 없다 — 버린다 */
  const useful = good.filter((c) => c.q !== c.a && c.a.length > 1)
  if (useful.length >= 3) return useful
  return [...useful, ...fromHeadings(root).filter((c) => c.a.length > 1)]
}
