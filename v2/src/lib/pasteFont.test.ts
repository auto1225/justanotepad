import { describe, it, expect } from 'vitest'
import { stripPastedFontFamily } from './pasteFont'

describe('붙여넣은 글의 글꼴 벗기기', () => {
  it('워드에서 온 글꼴은 벗긴다', () => {
    const out = stripPastedFontFamily(`<p><span style='font-family:"Arial",sans-serif'>가나다</span></p>`)
    expect(out).not.toMatch(/font-family/i)
    expect(out).toContain('가나다')
  })

  it('글꼴만 벗기고 나머지 서식은 남긴다', () => {
    const out = stripPastedFontFamily('<span style="font-family:Arial;color:red;font-weight:700">가나다</span>')
    expect(out).not.toMatch(/font-family/i)
    expect(out).toContain('color: red')
    expect(out).toContain('font-weight: 700')
  })

  it('글꼴 하나뿐이던 style 은 빈 껍데기로 남기지 않는다', () => {
    const out = stripPastedFontFamily('<span style="font-family:Arial">가나다</span>')
    expect(out).not.toContain('style')
  })

  it('우리 편집기에서 베껴 온 글은 건드리지 않는다 — 고른 글꼴이 따라가야 한다', () => {
    const mine = '<p data-pm-slice="1 1 []"><span style="font-family: Georgia">가나다</span></p>'
    expect(stripPastedFontFamily(mine)).toBe(mine)
  })

  it('표를 붙여넣어도 구조가 무너지지 않는다', () => {
    const out = stripPastedFontFamily(
      '<table><tbody><tr><td style="font-family:Arial;width:80px">가</td><td>나</td></tr></tbody></table>',
    )
    expect(out).not.toMatch(/font-family/i)
    expect(out).toContain('<table>')
    expect(out.match(/<td/g)).toHaveLength(2)
    expect(out).toContain('width: 80px')
    expect(out).toContain('가')
    expect(out).toContain('나')
  })

  it('글꼴이 없는 글은 그대로 돌려준다', () => {
    const plain = '<p>가나다</p>'
    expect(stripPastedFontFamily(plain)).toBe(plain)
  })
})
