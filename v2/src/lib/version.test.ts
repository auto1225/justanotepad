import { describe, expect, it } from 'vitest'
import { APP_VERSION, parseVersion } from './version'

describe('판 번호', () => {
  it('약속한 꼴을 지킨다 — V<큰 자리>.<세 자리>', () => {
    /* 꼴이 흐트러지면 「V1.1」 과 「V1.010」 이 섞여 어느 것이 새것인지 알 수 없게 된다 */
    expect(APP_VERSION).toMatch(/^V\d+\.\d{3}$/)
  })

  it('숫자로 견줄 수 있다', () => {
    expect(parseVersion('V1.001')).toEqual({ major: 1, minor: 1 })
    expect(parseVersion('V1.012')).toEqual({ major: 1, minor: 12 })
    expect(parseVersion('V2.000')).toEqual({ major: 2, minor: 0 })
  })

  it('꼴이 아닌 것은 0 으로 돌려준다 — 터지지 않는다', () => {
    expect(parseVersion('2.0.0')).toEqual({ major: 0, minor: 0 })
    expect(parseVersion('')).toEqual({ major: 0, minor: 0 })
  })
})
