import { describe, expect, it } from 'vitest'
import {
  ADJUST_DEFAULT, IMAGE_SHAPES, IMAGE_STYLES, IMAGE_WRAPS,
  adjustToFilter, adjustToString, cropToString, parseAdjust, parseCrop,
} from './ImageObject'

describe('그림 자르기 값', () => {
  it('네 변을 읽는다', () => {
    expect(parseCrop('0.1,0.2,0.3,0.4')).toEqual({ t: 0.1, r: 0.2, b: 0.3, l: 0.4 })
  })

  it('망가진 값은 없는 것으로 본다', () => {
    expect(parseCrop('')).toBeNull()
    expect(parseCrop('0.1,0.2')).toBeNull()
    expect(parseCrop('a,b,c,d')).toBeNull()
    expect(parseCrop(null)).toBeNull()
  })

  it('한 축을 다 잘라 없애는 값은 물리친다 — 그림이 사라지면 안 된다', () => {
    expect(parseCrop('0,0.5,0,0.5')).toBeNull()
    expect(parseCrop('0.5,0,0.5,0')).toBeNull()
  })

  it('적어 두었다 다시 읽으면 같은 값이다', () => {
    const crop = { t: 0.05, r: 0.1, b: 0, l: 0.25 }
    expect(parseCrop(cropToString(crop))).toEqual(crop)
  })
})

describe('그림 보정 값', () => {
  it('아무것도 안 건드렸으면 빈 문자열 — 저장본을 더럽히지 않는다', () => {
    expect(adjustToString(ADJUST_DEFAULT)).toBe('')
    expect(adjustToFilter(ADJUST_DEFAULT)).toBe('')
  })

  it('바꾼 것만 적는다', () => {
    expect(adjustToString({ ...ADJUST_DEFAULT, bright: 120 })).toBe('b:120')
    expect(adjustToString({ ...ADJUST_DEFAULT, gray: 100, sat: 50 })).toBe('s:50;g:100')
  })

  it('적어 두었다 다시 읽으면 같은 값이다', () => {
    const a = { ...ADJUST_DEFAULT, bright: 130, contrast: 90, hue: -20, sepia: 40 }
    expect(parseAdjust(adjustToString(a))).toEqual(a)
  })

  it('CSS 필터로 옮긴다', () => {
    expect(adjustToFilter({ ...ADJUST_DEFAULT, bright: 120, gray: 100 })).toBe('brightness(120%) grayscale(100%)')
  })

  it('알 수 없는 값은 기본값으로 둔다', () => {
    expect(parseAdjust('zzz')).toEqual(ADJUST_DEFAULT)
    expect(parseAdjust(undefined)).toEqual(ADJUST_DEFAULT)
  })
})

describe('갈래 목록', () => {
  it('워드의 텍스트 배치 여섯 가지가 다 있다', () => {
    expect(IMAGE_WRAPS.map((w) => w.key)).toEqual(['topbottom', 'inline', 'left', 'right', 'behind', 'front'])
  })

  it('그림 스타일과 도형 자르기에 겹치는 이름이 없다', () => {
    const styles = IMAGE_STYLES.map((s) => s.key)
    const shapes = IMAGE_SHAPES.map((s) => s.key)
    expect(new Set(styles).size).toBe(styles.length)
    expect(new Set(shapes).size).toBe(shapes.length)
    expect(shapes.every((s) => IMAGE_SHAPES.find((x) => x.key === s)?.clip)).toBe(true)
  })
})
