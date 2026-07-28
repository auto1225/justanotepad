import { describe, expect, it } from 'vitest'
import { mergeContinuedTables } from './tableSplit'

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
