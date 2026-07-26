import type { Editor } from '@tiptap/react'
import { flash } from './flash'

/**
 * 논문 작성 보조 도구 — 검사기·수식 템플릿·구성 블록·목록 자동 생성.
 */

/* ── 수식 템플릿 (자주 쓰는 12종 — LaTeX) ── */
export const MATH_TEMPLATES: ReadonlyArray<{ label: string; latex: string }> = [
  { label: '분수', latex: '\\frac{a}{b}' },
  { label: '근호', latex: '\\sqrt{x}' },
  { label: '합(시그마)', latex: '\\sum_{i=1}^{n} x_i' },
  { label: '적분', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: '극한', latex: '\\lim_{x \\to \\infty} f(x)' },
  { label: '행렬 2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: '편미분', latex: '\\frac{\\partial f}{\\partial x}' },
  { label: '벡터·내적', latex: '\\vec{a} \\cdot \\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta' },
  { label: '조건 분기', latex: 'f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & \\text{otherwise} \\end{cases}' },
  { label: '이항계수', latex: '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}' },
  { label: '화학식', latex: '\\ce{2H2 + O2 -> 2H2O}' },
  { label: '기대값·분산', latex: '\\mathbb{E}[X] = \\mu, \\quad \\mathrm{Var}(X) = \\sigma^2' },
]

/** 수식 템플릿 선택 오버레이 — 선택한 LaTeX 반환 (취소 시 null) */
export function pickMathTemplate(): Promise<string | null> {
  return new Promise((resolve) => {
    document.getElementById('jan-math-tpl-picker')?.remove()
    const wrap = document.createElement('div')
    wrap.id = 'jan-math-tpl-picker'
    wrap.className = 'jan-modal-overlay'
    const grid = MATH_TEMPLATES.map((t, i) =>
      `<button type="button" class="jan-math-tpl" data-i="${i}"><span class="jan-math-tpl-name">${escapeHtml(t.label)}</span><code>${escapeHtml(t.latex.length > 34 ? t.latex.slice(0, 34) + '…' : t.latex)}</code></button>`
    ).join('')
    wrap.innerHTML =
      '<div class="jan-modal jan-math-tpl-modal" role="dialog" aria-label="수식 템플릿 선택">' +
      '<div class="jan-modal-head"><h3>수식 템플릿</h3><button class="jan-modal-close" aria-label="닫기">닫기</button></div>' +
      `<div class="jan-modal-body jan-math-tpl-grid">${grid}</div></div>`
    const done = (v: string | null) => { wrap.remove(); resolve(v) }
    wrap.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target === wrap) { done(null); return }
      const btn = target.closest('.jan-math-tpl') as HTMLElement | null
      if (btn) done(MATH_TEMPLATES[Number(btn.dataset.i)].latex)
    })
    wrap.querySelector('.jan-modal-close')?.addEventListener('click', () => done(null))
    document.body.appendChild(wrap)
  })
}

/* ── 논문 구성 블록 ── */
export function insertCreditBlock(editor: Editor): void {
  editor.chain().focus().insertContent(
    '<h2>Author Contributions (CRediT)</h2>' +
    '<p><strong>저자 A:</strong> Conceptualization, Methodology, Writing – original draft. ' +
    '<strong>저자 B:</strong> Software, Validation, Data curation. ' +
    '<strong>저자 C:</strong> Supervision, Writing – review &amp; editing, Funding acquisition.</p>'
  ).run()
}

export function insertCoiBlock(editor: Editor): void {
  editor.chain().focus().insertContent(
    '<h2>Declaration of Competing Interest</h2>' +
    '<p>The authors declare that they have no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.</p>'
  ).run()
}

export function insertDataAvailabilityBlock(editor: Editor): void {
  editor.chain().focus().insertContent(
    '<h2>Data Availability</h2>' +
    '<p>The data that support the findings of this study are available from the corresponding author upon reasonable request. [또는: openly available at https://doi.org/...]</p>'
  ).run()
}

/* ── 그림/표 목록 자동 생성 (List of Figures / Tables) ── */
function captionTexts(editor: Editor, block: 'figcap' | 'tabcap'): string[] {
  const out: string[] = []
  editor.view.dom.querySelectorAll(`p[data-paper-block="${block}"]`).forEach((p) => {
    out.push((p.textContent || '').trim())
  })
  return out
}

export function insertListOfFigures(editor: Editor): void {
  const items = captionTexts(editor, 'figcap')
  if (!items.length) { flash('그림 캡션이 없습니다 — 먼저 "그림 캡션"을 삽입하세요'); return }
  const html = '<h2>List of Figures</h2><ul>' + items.map((t) => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>'
  editor.chain().focus().insertContent(html).run()
}

export function insertListOfTables(editor: Editor): void {
  const items = captionTexts(editor, 'tabcap')
  if (!items.length) { flash('표 캡션이 없습니다 — 먼저 "표 캡션"을 삽입하세요'); return }
  const html = '<h2>List of Tables</h2><ul>' + items.map((t) => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>'
  editor.chain().focus().insertContent(html).run()
}

/* ── 약어 목록 자동 추출 (2회 이상 등장한 대문자 약어) ── */
export function insertAcronymList(editor: Editor): void {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ')
  const counts = new Map<string, number>()
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9]{1,7}\b/g)) {
    const w = m[0]
    if (/^\d+$/.test(w)) continue
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  const acronyms = [...counts.entries()].filter(([, n]) => n >= 2).map(([w]) => w).sort()
  if (!acronyms.length) { flash('2회 이상 사용된 약어를 찾지 못했습니다'); return }
  const html = '<h2>Abbreviations</h2><ul>' + acronyms.map((a) => `<li><strong>${a}</strong> — </li>`).join('') + '</ul>'
  editor.chain().focus().insertContent(html).run()
  flash(`약어 ${acronyms.length}개 추출 — 뜻을 채워 넣으세요`)
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ── 논문 검사기 (제출 전 자동 점검) ── */
export interface LintItem {
  level: 'ok' | 'warn' | 'error'
  text: string
}

export function lintPaper(editor: Editor): LintItem[] {
  const items: LintItem[] = []
  const dom = editor.view.dom
  const fullText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')

  // 1. 제목
  const h1 = dom.querySelector('h1')
  if (!h1) items.push({ level: 'warn', text: '제목(H1)이 없습니다' })
  else if ((h1.textContent || '').length > 120) items.push({ level: 'warn', text: `제목이 깁니다 (${(h1.textContent || '').length}자) — 저널 다수는 100자 내외 권장` })
  else items.push({ level: 'ok', text: '제목 확인' })

  // 2. Abstract 길이
  // IEEE 계열은 "Abstract—본문…" 처럼 제목과 본문이 한 문단에 붙는다.
  // 줄바꿈을 요구하면 그 형식을 통째로 놓치므로, 구분 기호(—, –, -, :) 뒤부터
  // 다음 구획(빈 줄·Index Terms·Keywords·첫 절 번호)까지를 초록으로 본다.
  const absMatch = fullText.match(/abstract\s*[-–—:.]?\s*([\s\S]*?)(?=\n\s*\n|keywords|index terms|\n\s*(?:I\.|1[.\s]))/i)
  if (absMatch && absMatch[1].trim()) {
    const body = absMatch[1].trim()
    // 한글 초록은 단어가 아니라 글자 수로 센다 (국문 규정은 대개 400~1000자)
    const hangul = (body.match(/[가-힣]/g) || []).length
    if (hangul > body.replace(/\s/g, '').length * 0.3) {
      const chars = body.replace(/\s/g, '').length
      if (chars > 1200) items.push({ level: 'warn', text: `Abstract ${chars}자 — 국문 초록은 보통 400~1000자` })
      else if (chars < 150) items.push({ level: 'warn', text: `Abstract ${chars}자 — 너무 짧습니다` })
      else items.push({ level: 'ok', text: `Abstract ${chars}자` })
    } else {
      const words = body.split(/\s+/).filter(Boolean).length
      if (words > 300) items.push({ level: 'warn', text: `Abstract ${words}단어 — 대부분 저널은 150~250단어 제한` })
      else if (words < 40) items.push({ level: 'warn', text: `Abstract ${words}단어 — 너무 짧습니다` })
      else items.push({ level: 'ok', text: `Abstract ${words}단어` })
    }
  } else items.push({ level: 'warn', text: 'Abstract 를 찾지 못했습니다' })

  // 3. References 섹션
  if (/references|참고\s*문헌/i.test(fullText)) items.push({ level: 'ok', text: 'References 섹션 확인' })
  else items.push({ level: 'warn', text: 'References 섹션이 없습니다' })

  // 4~6. 수식/그림/표 번호 연속성
  const checkSeq = (kind: string, label: string) => {
    const ns = [...dom.querySelectorAll(`span[data-paper-tag="${kind}"]`)].map((el) => Number(el.getAttribute('data-n')) || 0)
    if (!ns.length) return
    const expect = ns.map((_, i) => i + 1)
    const okSeq = ns.every((n, i) => n === expect[i])
    if (okSeq) items.push({ level: 'ok', text: `${label} 번호 연속 (1~${ns.length})` })
    else items.push({ level: 'error', text: `${label} 번호 불연속: [${ns.join(', ')}] — "번호 재정렬"을 실행하세요` })
  }
  checkSeq('eqnum', '수식')
  checkSeq('figlabel', '그림')
  checkSeq('tablabel', '표')

  // 7. 깨진 상호참조
  const targetKeys = new Set<string>()
  dom.querySelectorAll('span[data-paper-tag="eqnum"],span[data-paper-tag="figlabel"],span[data-paper-tag="tablabel"]').forEach((el) => {
    const k = el.getAttribute('data-key'); if (k) targetKeys.add(k)
  })
  let broken = 0
  dom.querySelectorAll('span[data-paper-tag="ref"]').forEach((el) => {
    const k = el.getAttribute('data-key')
    if (!k || !targetKeys.has(k)) broken++
  })
  if (broken > 0) items.push({ level: 'error', text: `깨진 상호참조 ${broken}개 — 대상 수식/그림/표가 삭제되었습니다` })
  else if (dom.querySelector('span[data-paper-tag="ref"]')) items.push({ level: 'ok', text: '상호참조 대상 모두 유효' })

  // 8. 캡션 없는 이미지
  // ProseMirror 가 문단 끝에 넣는 빈 <img class="ProseMirror-separator"> 는 내용이 아니다 —
  // 세면 수식 문단마다 "캡션 없는 이미지"가 하나씩 늘어난다.
  const imgs = [...dom.querySelectorAll('img')].filter((img) => img.getAttribute('src') && !img.classList.contains('ProseMirror-separator'))
  let noCap = 0
  imgs.forEach((img) => {
    // 그림이 문단 안에 있으면 그 문단 다음을, 블록으로 놓였으면 그림 자신의 다음을 본다
    const anchor = img.closest('p, figure') || img
    const next = anchor.nextElementSibling
    if (!next || next.getAttribute('data-paper-block') !== 'figcap') noCap++
  })
  if (imgs.length && noCap > 0) items.push({ level: 'warn', text: `캡션 없는 이미지 ${noCap}/${imgs.length}개 — "그림 캡션"으로 번호를 부여하세요` })
  else if (imgs.length) items.push({ level: 'ok', text: `이미지 ${imgs.length}개 모두 캡션 있음` })

  // 9. 빈 섹션
  let emptySections = 0
  dom.querySelectorAll('h1, h2, h3').forEach((h) => {
    const next = h.nextElementSibling
    if (!next || /^H[1-3]$/.test(next.tagName)) emptySections++
    else if (next.tagName === 'P' && !(next.textContent || '').trim()) {
      const after = next.nextElementSibling
      if (!after || /^H[1-3]$/.test(after.tagName)) emptySections++
    }
  })
  if (emptySections > 0) items.push({ level: 'warn', text: `내용이 비어 있는 섹션 ${emptySections}개` })

  // 10. 과도하게 긴 문장 (가독성)
  const sentences = fullText.split(/(?<=[.!?다요음됨])\s+/)
  const longOnes = sentences.filter((s) => s.trim().split(/\s+/).length > 60).length
  if (longOnes > 0) items.push({ level: 'warn', text: `60단어를 넘는 문장 ${longOnes}개 — 나눠 쓰기를 권장` })
  else items.push({ level: 'ok', text: '문장 길이 양호' })

  return items
}

/** 검사 결과를 간단한 오버레이 리포트로 표시 */
export function showLintReport(items: LintItem[]): void {
  document.getElementById('jan-paper-lint-report')?.remove()
  const wrap = document.createElement('div')
  wrap.id = 'jan-paper-lint-report'
  wrap.className = 'jan-modal-overlay'
  const icon = (lv: LintItem['level']) => (lv === 'ok' ? 'OK' : lv === 'warn' ? '주의' : '오류')
  wrap.innerHTML =
    '<div class="jan-modal jan-lint-modal" role="dialog" aria-label="논문 검사 결과">' +
    '<div class="jan-modal-head"><h3>논문 검사 결과</h3><button class="jan-modal-close" aria-label="닫기">닫기</button></div>' +
    '<div class="jan-modal-body jan-lint-body">' +
    items.map((it) => `<div class="jan-lint-item is-${it.level}"><span class="jan-lint-badge">${icon(it.level)}</span><span>${escapeHtml(it.text)}</span></div>`).join('') +
    `<div class="jan-lint-summary">오류 ${items.filter((i) => i.level === 'error').length} · 주의 ${items.filter((i) => i.level === 'warn').length} · 통과 ${items.filter((i) => i.level === 'ok').length}</div>` +
    '</div></div>'
  const close = () => wrap.remove()
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close() })
  wrap.querySelector('.jan-modal-close')?.addEventListener('click', close)
  document.body.appendChild(wrap)
}
