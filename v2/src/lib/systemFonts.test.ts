import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cssFontValue, detectInstalledFonts, canQueryLocalFonts, getKnownFonts, clearFontCache } from './systemFonts'

describe('systemFonts', () => {
  beforeEach(() => {
    clearFontCache()
  })

  it('CSS 값으로 쓸 때 필요한 이름만 따옴표로 감싼다', () => {
    expect(cssFontValue('Arial')).toBe('Arial')
    expect(cssFontValue('Times New Roman')).toBe('Times New Roman')
    expect(cssFontValue('맑은 고딕')).toBe('"맑은 고딕"')
    expect(cssFontValue('D2Coding 1.3')).toBe('"D2Coding 1.3"')
  })

  it('설치된 글꼴만 남긴다 (document.fonts.check 로 두드려 본다)', () => {
    const installed = new Set(['Arial', '"맑은 고딕"'])
    document.fonts = {
      check: (spec: string) => [...installed].some((f) => spec.endsWith(f)),
    } as unknown as FontFaceSet

    const found = detectInstalledFonts(['Arial', '맑은 고딕', '없는글꼴XYZ'])
    expect(found.map((f) => f.label).sort()).toEqual(['Arial', '맑은 고딕'])
  })

  it('탐지 결과가 없으면 빈 목록을 준다 (오류를 던지지 않는다)', () => {
    document.fonts = { check: () => false } as unknown as FontFaceSet
    expect(detectInstalledFonts(['Arial'])).toEqual([])
    expect(getKnownFonts()).toEqual([])
  })

  it('queryLocalFonts 지원 여부를 알려 준다', () => {
    const w = window as unknown as { queryLocalFonts?: unknown }
    delete w.queryLocalFonts
    expect(canQueryLocalFonts()).toBe(false)
    w.queryLocalFonts = vi.fn()
    expect(canQueryLocalFonts()).toBe(true)
    delete w.queryLocalFonts
  })
})
