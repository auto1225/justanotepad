import { describe, expect, it } from 'vitest'
import { makeCards } from './flashcards'

function dom(html: string): ParentNode {
  const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  return d.getElementById('r') as ParentNode
}

describe('플래시카드로 뽑을 것 고르기', () => {
  it('확인 문제는 문제와 답이 그대로 카드가 된다', () => {
    const cards = makeCards(dom(`
      <h2>6. 확인 문제</h2>
      <ol>
        <li><strong>횡파 마루 간격이 45 m 면 배의 속도는?</strong><br>답. 8.4 m/s ≈ 16.3 kn</li>
        <li><strong>수심 8 m 운하의 임계 속도는?</strong><br>답. 8.86 m/s ≈ 17.2 kn</li>
        <li><strong>19.47° 는 전체 쐐기각인가?</strong><br>답. 아니다. 반각이다.</li>
      </ol>`))
    expect(cards).toHaveLength(3)
    expect(cards[0].from).toBe('quiz')
    expect(cards[0].q).toContain('45 m')
    expect(cards[0].a).toContain('16.3 kn')
    /* 앞면에 답이 묻어 나오면 카드가 아니다 */
    expect(cards[0].q).not.toContain('8.4 m/s')
  })

  it('핵심 개념은 개념 이름을 묻고 정의를 답한다 — 번호는 떼고', () => {
    const cards = makeCards(dom(`
      <h3>4.2 군속도가 위상속도의 절반이다</h3>
      <p>정의. c_g = c/2 다.</p>
      <p>왜 필요한가. 각에서 U 를 지운다.</p>
      <p>흔한 오해. 늘 절반인 것은 아니다.</p>
      <h3>4.3 정상 조건</h3>
      <p>정의. c = U cos θ 다.</p>
      <p>왜 필요한가. 무늬를 만드는 파를 고른다.</p>
      <h3>4.4 자기 닮음</h3>
      <p>정의. 길이 척도가 U²/g 하나뿐이다.</p>`))
    expect(cards).toHaveLength(3)
    expect(cards[0].from).toBe('concept')
    expect(cards[0].q).toBe('군속도가 위상속도의 절반이다')
    expect(cards[0].a).toContain('c_g = c/2')
    expect(cards[0].a).toContain('흔한 오해')
  })

  it('용어표만 카드로 삼는다 — 숫자표까지 외우게 하지 않는다', () => {
    const cards = makeCards(dom(`
      <h2>용어</h2>
      <table><thead><tr><th>우리말</th><th>영어</th><th>뜻</th></tr></thead>
      <tbody>
        <tr><td>켈빈 항적</td><td>Kelvin wake</td><td>정속 항행체 뒤의 정상 파 무늬</td></tr>
        <tr><td>군속도</td><td>group velocity</td><td>에너지가 가는 속도</td></tr>
        <tr><td>첨점</td><td>cusp</td><td>두 갈래가 겹치는 자리</td></tr>
      </tbody></table>
      <table><thead><tr><th>속도</th><th>파장</th></tr></thead>
      <tbody><tr><td>5 m/s</td><td>16.0 m</td></tr></tbody></table>`))
    expect(cards.every((c) => c.from === 'term')).toBe(true)
    expect(cards).toHaveLength(3)
    expect(cards[0].q).toBe('켈빈 항적')
    expect(cards[0].a).toContain('Kelvin wake')
    /* 숫자표는 손대지 않는다 */
    expect(cards.some((c) => c.q === '5 m/s')).toBe(false)
  })

  it('외울 자리가 없으면 제목으로 물러선다', () => {
    const cards = makeCards(dom('<h2>배경</h2><p>배 뒤에 물결이 남는다.</p>'))
    expect(cards).toHaveLength(1)
    expect(cards[0].from).toBe('heading')
    expect(cards[0].q).toBe('배경')
  })

  it('앞뒤가 같거나 답이 빈 카드는 버린다', () => {
    const cards = makeCards(dom('<h2>제목만 있는 절</h2><h2>또 제목</h2>'))
    expect(cards).toHaveLength(0)
  })
})
