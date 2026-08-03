import { describe, expect, it } from 'vitest'
import { mergeContinuedTables, ownRows } from './tableSplit'

describe('쪽을 넘어 나뉜 표 합치기', () => {
  it('이어짐 표시가 붙은 표를 앞 표에 도로 붙인다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>2</td></tr><tr><td>3</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<table/g)).toHaveLength(1)
    expect(merged.match(/<tr/g)).toHaveLength(4) // 제목 + 1,2,3
    expect(merged).not.toContain('data-cont')
  })

  it('반복해 넣은 제목 행은 합칠 때 지운다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr data-repeated="1"><th>이름</th></tr><tr><td>2</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<tr/g)).toHaveLength(3) // 제목 + 1 + 2 (복제된 제목은 빠진다)
    expect(merged).not.toContain('data-repeated')
  })

  it('세 조각으로 나뉘어도 모두 합친다', () => {
    const html =
      '<table><tbody><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>2</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>3</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged.match(/<table/g)).toHaveLength(1)
    expect(merged.match(/<tr/g)).toHaveLength(3)
  })

  it('앞에 붙일 표가 없으면 표시만 지운다 (내용을 잃지 않는다)', () => {
    const html = '<p>글</p><table data-cont="1"><tbody><tr><td>1</td></tr></tbody></table>'
    const merged = mergeContinuedTables(html)
    expect(merged).toContain('<td>1</td>')
    expect(merged).not.toContain('data-cont')
  })

  it('이어짐 표시가 없으면 그대로 둔다', () => {
    const html = '<table><tbody><tr><td>1</td></tr></tbody></table>'
    expect(mergeContinuedTables(html)).toBe(html)
  })
})

/**
 * 표 안에 든 표(중첩)를 남의 행으로 세면 표가 무너진다.
 *
 * querySelectorAll('tr') 은 칸 안에 든 표의 행까지 함께 걷어 온다. 그래서
 *  - 나눌 자리를 셀 때는 바깥 행이 몇 개인지를 부풀려 세어 쪽 밖으로 넘치고,
 *  - 합칠 때는 안쪽 표의 행을 뽑아 바깥 표 끝에 붙여 버려 안쪽 표가 빈 껍데기가 된다.
 * 표는 제 행만 제 것이다.
 */
describe('중첩된 표', () => {
  const html2dom = (html: string) => {
    const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
    return d.getElementById('r')!
  }

  it('제 행만 센다 — 칸 안에 든 표의 행은 세지 않는다', () => {
    const root = html2dom(
      '<table><tbody>' +
      '<tr><td><table><tbody><tr><td>안1</td></tr><tr><td>안2</td></tr></tbody></table></td></tr>' +
      '<tr><td>바깥2</td></tr>' +
      '</tbody></table>'
    )
    const outer = root.querySelector('table') as HTMLElement
    expect(outer.querySelectorAll('tr')).toHaveLength(4) // 모두 세면 넷 (부풀려진 수)
    expect(ownRows(outer)).toHaveLength(2)               // 바깥 표의 행은 둘뿐이다
  })

  it('합칠 때 안쪽 표의 행을 바깥으로 끌어내지 않는다', () => {
    const html =
      '<table><tbody><tr><td>1</td></tr></tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr><td><table><tbody><tr><td>안A</td></tr><tr><td>안B</td></tr></tbody></table></td></tr>' +
      '<tr><td>2</td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    expect(root.querySelectorAll('table')).toHaveLength(2)      // 바깥 하나 + 안쪽 하나
    expect(ownRows(outer)).toHaveLength(3)                      // 1 · 중첩이 든 행 · 2
    const inner = root.querySelector('table table') as HTMLElement
    expect(inner).not.toBeNull()
    expect(ownRows(inner)).toHaveLength(2)                      // 안쪽 표는 제 행 둘을 그대로 가진다
    expect(inner.textContent).toContain('안A')
    expect(inner.textContent).toContain('안B')
  })

  it('앞 조각 첫 칸에 표가 들어 있어도 뒤 조각을 그 안쪽 표에 붙이지 않는다', () => {
    const html =
      '<table><tbody><tr><td><table><tbody><tr><td>안</td></tr></tbody></table></td></tr></tbody></table>' +
      '<table data-cont="1"><tbody><tr><td>뒤</td></tr></tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const outer = root.querySelector('table') as HTMLElement
    const inner = root.querySelector('table table') as HTMLElement
    expect(ownRows(outer)).toHaveLength(2)  // 중첩이 든 행 + 뒤
    expect(ownRows(inner)).toHaveLength(1)  // 안쪽 표는 건드리지 않는다
    expect(inner.textContent).toBe('안')
  })

  it('반복 제목 행을 지울 때 안쪽 표의 행은 건드리지 않는다', () => {
    const html =
      '<table><tbody><tr><th>이름</th></tr></tbody></table>' +
      '<table data-cont="1"><tbody>' +
      '<tr data-repeated="1"><th>이름</th></tr>' +
      '<tr><td><table><tbody><tr data-repeated="1"><td>안쪽 제목</td></tr></tbody></table></td></tr>' +
      '</tbody></table>'
    const root = html2dom(mergeContinuedTables(html))
    const inner = root.querySelector('table table') as HTMLElement
    expect(inner).not.toBeNull()
    expect(ownRows(inner)).toHaveLength(1)
    expect(inner.textContent).toContain('안쪽 제목')
  })
})
