import { describe, it, expect } from 'vitest'
import {
  DOC_KINDS, cleanDocHtml, directPrompt, docKind, htmlFromAi, markdownToHtml, outlinePrompt, writePrompt,
} from './aiWrite'

describe('문서 자동 작성 — 받아 온 답 다루기', () => {
  it('코드 울타리로 감싸 와도 벗겨 낸다', () => {
    const html = htmlFromAi('```html\n<h1>보고서</h1><p>본문</p>\n```')
    expect(html).toBe('<h1>보고서</h1><p>본문</p>')
  })

  it('마크다운으로 와도 제목·목록·표를 살려 옮긴다', () => {
    const md = [
      '# 상반기 보고',
      '## 현황',
      '- 첫째',
      '- 둘째',
      '',
      '| 항목 | 값 |',
      '| --- | --- |',
      '| 매출 | 120 |',
      '',
      '1. 먼저',
      '2. 다음',
    ].join('\n')
    const html = htmlFromAi(md)
    expect(html).toContain('<h1>상반기 보고</h1>')
    expect(html).toContain('<h2>현황</h2>')
    expect(html).toContain('<ul><li>첫째</li><li>둘째</li></ul>')
    expect(html).toContain('<th>항목</th>')
    expect(html).toContain('<td>매출</td>')
    expect(html).toContain('<ol><li>먼저</li>')
    /* 표 가름줄(---)은 칸으로 새지 않는다 */
    expect(html).not.toContain('---')
  })

  it('굵게 · 기울임을 옮긴다', () => {
    expect(markdownToHtml('**중요**한 것과 *덧붙임*')).toContain('<strong>중요</strong>')
    expect(markdownToHtml('- *기울임*')).toContain('<em>기울임</em>')
  })

  it('스크립트와 손잡이는 걸러 낸다 — 모델이 낸 글을 그대로 붙이지 않는다', () => {
    const dirty = '<h1 onclick="steal()">제목</h1><script>alert(1)</script><p style="x">글</p><img src=x onerror=y>'
    const clean = cleanDocHtml(dirty)
    expect(clean).toContain('<h1>제목</h1>')
    expect(clean).toContain('<p>글</p>')
    expect(clean).not.toContain('script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('style')
    expect(clean).not.toContain('<img')
  })

  it('표의 칸 합치기는 남긴다 (문서에 쓸모가 있다)', () => {
    const clean = cleanDocHtml('<table><tbody><tr><td colspan="2" class="x">합친 칸</td></tr></tbody></table>')
    expect(clean).toContain('colspan="2"')
    expect(clean).not.toContain('class')
  })

  it('허락하지 않은 껍데기는 벗기고 안의 글은 살린다', () => {
    const clean = cleanDocHtml('<div><section><p>남는 글</p></section></div>')
    expect(clean).toBe('<p>남는 글</p>')
  })

  it('빈 답은 빈 값으로 돌려준다 (없는 문서를 넣지 않게)', () => {
    expect(htmlFromAi('')).toBe('')
    expect(htmlFromAi('   \n  ')).toBe('')
  })
})

describe('문서 자동 작성 — 지시문', () => {
  it('갈래마다 뼈대가 있다', () => {
    expect(DOC_KINDS.length).toBeGreaterThanOrEqual(10)
    for (const k of DOC_KINDS) {
      expect(k.label.length).toBeGreaterThan(1)
      expect(k.frame.length).toBeGreaterThan(20)
    }
  })

  it('없는 갈래를 물으면 첫 갈래로 되돌린다', () => {
    expect(docKind('없는것').key).toBe(DOC_KINDS[0].key)
  })

  const spec = {
    topic: '고객 이탈 원인 분석', kind: 'report', length: 'normal' as const,
    tone: 'plain' as const, reader: '임원', extra: '2025년 이탈률 12%',
  }

  it('목차 걸음은 본문을 쓰지 말라고 못 박는다', () => {
    const p = outlinePrompt(spec)
    expect(p).toContain('목차만')
    expect(p).toContain('본문은 아직 쓰지 않는다')
    expect(p).toContain('고객 이탈 원인 분석')
    expect(p).toContain('임원')
  })

  it('본문 걸음은 목차를 그대로 받아 넣는다', () => {
    const p = writePrompt(spec, '1. 요약 — 결론 먼저')
    expect(p).toContain('1. 요약 — 결론 먼저')
    expect(p).toContain('아래 목차대로')
  })

  it('지어내지 말고 【확인】 으로 남기라고 시킨다 — 전문가 문서의 갈림길', () => {
    for (const p of [directPrompt(spec), writePrompt(spec, '1. 요약')]) {
      expect(p).toContain('지어내지 않는다')
      expect(p).toContain('【확인:')
      expect(p).toContain('겉치레')
      /* 마크다운이 아니라 HTML 로 받는다 */
      expect(p).toContain('HTML 로만 적는다')
    }
  })

  it('알려 준 사실은 지시문에 그대로 실린다', () => {
    expect(directPrompt(spec)).toContain('2025년 이탈률 12%')
  })
})
