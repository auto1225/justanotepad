import { describe, it, expect, beforeEach } from 'vitest'
import { splitColumns, layoutStamp, stampPixels, loadStamps, saveStamp, removeStamp } from './stamp'

describe('도장 글자 앉히기', () => {
  it('세 글자는 성 한 자가 오른쪽 줄을 통째로 쓴다', () => {
    /* 홍길동 도장은 「홍」 이 오른쪽에 크게 서고 「길동」 이 왼쪽에 포개진다.
       고르게 나누면 오른쪽에 두 자가 가서 이름이 갈라진다. */
    expect(splitColumns(3)).toEqual([1, 2])
    const cells = layoutStamp('홍길동')
    expect(cells.map((c) => c.ch)).toEqual(['홍', '길', '동'])
    /* 홍은 오른쪽 줄(x 가 큰 쪽) 이고 줄 전체 높이를 쓴다 */
    expect(cells[0].x).toBeGreaterThan(cells[1].x)
    expect(cells[0].h).toBe(1)
    expect(cells[1].h).toBe(0.5)
  })

  it('전통 차례는 오른쪽 줄부터 읽고, 현대 차례는 왼쪽부터다', () => {
    const trad = layoutStamp('가나다라')
    const modern = layoutStamp('가나다라', { order: 'modern' })
    expect(trad[0].x).toBeGreaterThan(trad[2].x) // 가 가 오른쪽
    expect(modern[0].x).toBeLessThan(modern[2].x) // 가 가 왼쪽
  })

  it('두 글자는 세로로 포개고, 가로쓰기를 고르면 한 줄에 늘어놓는다', () => {
    const v = layoutStamp('인장')
    expect(v[0].x).toBe(v[1].x)
    expect(v[1].y).toBeGreaterThan(v[0].y)
    const h = layoutStamp('인장', { horizontal: true })
    expect(h[0].y).toBe(h[1].y)
    expect(h[1].x).toBeGreaterThan(h[0].x)
  })

  it('여섯 글자 직인은 두 줄 세 칸으로 서고, 남는 글자는 먼저 읽는 줄이 받는다', () => {
    expect(splitColumns(6)).toEqual([3, 3])
    expect(splitColumns(5)).toEqual([3, 2]) // 오른쪽 줄이 한 자 더
    expect(splitColumns(4)).toEqual([2, 2])
    expect(splitColumns(1)).toEqual([1])
  })

  it('칸은 서로 겹치지 않고 네모를 남김없이 채운다', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 9]) {
      const text = '가나다라마바사아자'.slice(0, n)
      const cells = layoutStamp(text)
      expect(cells).toHaveLength(n)
      const area = cells.reduce((s, c) => s + c.w * c.h, 0)
      expect(area).toBeCloseTo(1, 5)
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(1.00001)
        expect(c.y + c.h).toBeLessThanOrEqual(1.00001)
      }
    }
  })

  it('빈 이름이나 공백만 있으면 아무 칸도 없다', () => {
    expect(layoutStamp('')).toEqual([])
    expect(layoutStamp('   ')).toEqual([])
    expect(splitColumns(0)).toEqual([])
  })

  it('사이에 낀 공백은 글자로 세지 않는다', () => {
    expect(layoutStamp('홍 길 동').map((c) => c.ch)).toEqual(['홍', '길', '동'])
  })

  it('찍어 내는 촘촘함은 인쇄를 견딘다 — 25mm 가 590px 을 넘는다', () => {
    /* 화면 기준(96dpi)으로 만들면 25mm 가 94px 이라 인쇄하면 가장자리가 톱니가 된다 */
    expect(stampPixels(25)).toBeGreaterThan(590)
    expect(stampPixels(15)).toBeGreaterThan(350)
  })
})

describe('도장 서랍', () => {
  beforeEach(() => { localStorage.clear() })

  it('넣어 둔 도장을 다시 꺼내 쓰고, 버릴 수도 있다', () => {
    /* 도장은 한 번 새기고 여러 문서에 되풀이해 찍는 물건이다 */
    expect(loadStamps()).toEqual([])
    saveStamp({ name: '홍길동', src: 'data:image/png;base64,AA', mm: 15 })
    const list = saveStamp({ name: '대표이사인', src: 'data:image/png;base64,BB', mm: 25 })
    expect(list.map((s) => s.name)).toEqual(['대표이사인', '홍길동']) // 새것이 앞에
    expect(loadStamps()).toHaveLength(2)
    const left = removeStamp(list[0].id)
    expect(left.map((s) => s.name)).toEqual(['홍길동'])
    expect(loadStamps()).toHaveLength(1)
  })

  it('서랍이 깨져 있어도 앱이 멈추지 않는다', () => {
    localStorage.setItem('jan-v2-stamps', '{ 이건 JSON 이 아니다')
    expect(loadStamps()).toEqual([])
    localStorage.setItem('jan-v2-stamps', '[null, 3, {"name":"ㄱ","src":"data:x","mm":15}]')
    expect(loadStamps()).toHaveLength(1)
  })
})
