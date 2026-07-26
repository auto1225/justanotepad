import { describe, expect, it } from 'vitest'
import {
  clampTypographySettings,
  detectTypographyPreset,
  getTypographyPreset,
  normalizeFontFamily,
} from './typographyStore'

describe('typographyStore helpers', () => {
  it('묶음 이름은 그대로 두고, 이 컴퓨터 글꼴은 CSS 값 그대로 받는다', () => {
    expect(normalizeFontFamily('serif')).toBe('serif')
    // 사용자가 고른 시스템 글꼴 — 미리 정한 3종에 없어도 그대로 쓴다
    expect(normalizeFontFamily('"맑은 고딕"')).toBe('"맑은 고딕"')
    expect(normalizeFontFamily('Georgia')).toBe('Georgia')
    // 빈 값만 기본값으로 되돌린다
    expect(normalizeFontFamily('')).toBe('sans')
    expect(normalizeFontFamily('   ')).toBe('sans')
  })

  const BASE = { letterSpacing: 0, charScale: 100, textIndent: 0, align: 'left' as const }

  it('입력값을 문서에서 쓸 수 있는 범위로만 자른다 (넓게 허용)', () => {
    // 워드·한글처럼 직접 입력하므로 범위가 넓다 — 4~200px, 0.5~5배, 0~200px
    expect(clampTypographySettings({
      ...BASE,
      fontFamily: 'mono',
      fontSize: 42,
      lineHeight: 0.8,
      paragraphSpacing: -4,
    })).toEqual({
      ...BASE,
      fontFamily: 'mono',
      fontSize: 42,
      lineHeight: 0.8,
      paragraphSpacing: 0,
    })
    // 범위를 벗어나면 잘린다
    expect(clampTypographySettings({
      ...BASE,
      fontFamily: 'sans',
      fontSize: 999,
      lineHeight: 9,
      paragraphSpacing: 999,
    })).toEqual({
      ...BASE,
      fontFamily: 'sans',
      fontSize: 200,
      lineHeight: 5,
      paragraphSpacing: 200,
    })
  })

  it('자간·장평·들여쓰기·정렬도 쓸 수 있는 범위로 자른다', () => {
    const wild = clampTypographySettings({
      ...BASE, fontFamily: 'serif', fontSize: 14, lineHeight: 1.5, paragraphSpacing: 8,
      letterSpacing: -900, charScale: 900, textIndent: -3, align: 'center' as unknown as 'left',
    })
    expect(wild).toMatchObject({ letterSpacing: -50, charScale: 250, textIndent: 0, align: 'left' })

    const ok = clampTypographySettings({
      ...BASE, fontFamily: 'serif', fontSize: 14, lineHeight: 1.5, paragraphSpacing: 8,
      letterSpacing: -1.5, charScale: 95, textIndent: 1, align: 'justify',
    })
    expect(ok).toMatchObject({ letterSpacing: -1.5, charScale: 95, textIndent: 1, align: 'justify' })
  })

  it('detects a preset from exact typography settings', () => {
    const preset = getTypographyPreset('manuscript')

    expect(detectTypographyPreset(preset)).toBe('manuscript')
    expect(detectTypographyPreset({ ...preset, fontSize: preset.fontSize + 1 })).toBe('custom')
  })
})
