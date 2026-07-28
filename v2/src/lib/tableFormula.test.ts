import { describe, expect, it } from 'vitest'
import {
  cellNumber,
  columnIndexFromLetters,
  columnLetters,
  evaluateFormula,
  formatNumber,
  type FormulaContext,
} from './tableFormula'

/** 워드 도움말의 보기와 같은 모양의 표 */
const GRID = [
  ['항목', '1분기', '2분기'],
  ['서울', '1,200', '1,500'],
  ['부산', '800', '950'],
  ['대구', '(100)', '12.5%'],
  ['합계', '', ''],
]

const at = (row: number, col: number): FormulaContext => ({ grid: GRID, row, col })

describe('칸의 숫자 읽기', () => {
  it('쉼표·통화·백분율·괄호 음수를 모두 읽는다', () => {
    expect(cellNumber('1,200')).toBe(1200)
    expect(cellNumber('₩1,200')).toBe(1200)
    expect(cellNumber('12.5%')).toBe(0.125)
    expect(cellNumber('(100)')).toBe(-100)
    expect(cellNumber('-3.5')).toBe(-3.5)
  })

  it('숫자가 아닌 칸은 비운다', () => {
    expect(cellNumber('합계')).toBeNull()
    expect(cellNumber('')).toBeNull()
    expect(cellNumber('3 s')).toBeNull()
  })
})

describe('A1 주소', () => {
  it('열 문자와 번호를 서로 바꾼다', () => {
    expect(columnIndexFromLetters('A')).toBe(0)
    expect(columnIndexFromLetters('Z')).toBe(25)
    expect(columnIndexFromLetters('AA')).toBe(26)
    expect(columnLetters(0)).toBe('A')
    expect(columnLetters(25)).toBe('Z')
    expect(columnLetters(26)).toBe('AA')
  })
})

describe('수식 — 워드와 같은 문법', () => {
  it('방향 낱말로 더한다', () => {
    // 합계 줄(4행)에서 위쪽을 더하면 숫자가 이어진 데까지만 (대구 -100, 부산 800, 서울 1200)
    expect(evaluateFormula('=SUM(ABOVE)', at(4, 1))).toBe(1900)
  })

  it('숫자가 아닌 칸을 만나면 거기서 멈춘다 (워드와 같다)', () => {
    // 1열은 글자뿐이라 더할 것이 없다
    expect(evaluateFormula('=SUM(ABOVE)', at(4, 0))).toBe(0)
  })

  it('왼쪽·오른쪽도 센다', () => {
    expect(evaluateFormula('=SUM(LEFT)', at(1, 2))).toBe(1200)
    expect(evaluateFormula('=SUM(RIGHT)', at(1, 1))).toBe(1500)
  })

  it('A1 주소와 범위를 읽는다', () => {
    expect(evaluateFormula('=B2', at(4, 1))).toBe(1200)
    expect(evaluateFormula('=SUM(B2:B4)', at(4, 1))).toBe(1900)
    expect(evaluateFormula('=SUM(B2:C3)', at(4, 1))).toBe(4450)
  })

  it('사칙연산과 괄호를 섞어 쓴다', () => {
    expect(evaluateFormula('=SUM(B2:B3)/2', at(4, 1))).toBe(1000)
    expect(evaluateFormula('=(B2+C2)*2', at(4, 1))).toBe(5400)
    expect(evaluateFormula('=2^10', at(0, 0))).toBe(1024)
  })

  it('평균·개수·최대·최소·곱', () => {
    expect(evaluateFormula('=AVERAGE(B2:B3)', at(4, 1))).toBe(1000)
    expect(evaluateFormula('=COUNT(B2:B4)', at(4, 1))).toBe(3)
    expect(evaluateFormula('=MAX(B2:B4)', at(4, 1))).toBe(1200)
    expect(evaluateFormula('=MIN(B2:B4)', at(4, 1))).toBe(-100)
    expect(evaluateFormula('=PRODUCT(2,3,4)', at(0, 0))).toBe(24)
  })

  it('반올림·버림·절댓값·나머지·부호', () => {
    expect(evaluateFormula('=ROUND(3.14159, 2)', at(0, 0))).toBe(3.14)
    expect(evaluateFormula('=INT(3.9)', at(0, 0))).toBe(3)
    expect(evaluateFormula('=ABS(0-7)', at(0, 0))).toBe(7)
    expect(evaluateFormula('=MOD(10, 3)', at(0, 0))).toBe(1)
    expect(evaluateFormula('=SIGN(0-2)', at(0, 0))).toBe(-1)
  })

  it('조건과 논리 함수', () => {
    expect(evaluateFormula('=IF(SUM(B2:B3)>1000, 1, 0)', at(4, 1))).toBe(1)
    expect(evaluateFormula('=IF(B2>C2, 10, 20)', at(4, 1))).toBe(20)
    expect(evaluateFormula('=AND(1,1)', at(0, 0))).toBe(1)
    expect(evaluateFormula('=OR(0,0)', at(0, 0))).toBe(0)
    expect(evaluateFormula('=NOT(0)', at(0, 0))).toBe(1)
    expect(evaluateFormula('=TRUE()', at(0, 0))).toBe(1)
  })

  it('잘못 쓴 수식은 값을 내지 않는다 (칸의 글자를 지우지 않으려고)', () => {
    expect(evaluateFormula('=SUM(', at(0, 0))).toBeNull()
    expect(evaluateFormula('=알수없음(1)', at(0, 0))).toBeNull()
    expect(evaluateFormula('=1 2', at(0, 0))).toBeNull()
    expect(evaluateFormula('', at(0, 0))).toBeNull()
  })

  it('0 으로 나눠도 멈추지 않는다', () => {
    expect(evaluateFormula('=1/0', at(0, 0))).toBe(0)
  })
})

describe('번호 형식 — 워드의 「번호 형식」', () => {
  it('자릿수·소수점·백분율·통화', () => {
    expect(formatNumber(1234.567, '#,##0')).toBe('1,235')
    expect(formatNumber(1234.567, '#,##0.00')).toBe('1,234.57')
    expect(formatNumber(1234.5, '0.00')).toBe('1234.50')
    expect(formatNumber(0.125, '0%')).toBe('13%')
    expect(formatNumber(0.125, '0.0%')).toBe('12.5%')
    expect(formatNumber(1234, '₩#,##0')).toBe('₩1,234')
  })

  it('형식을 고르지 않으면 값 그대로 (부동소수점 꼬리는 정리)', () => {
    expect(formatNumber(1000)).toBe('1000')
    expect(formatNumber(0.1 + 0.2)).toBe('0.3')
  })

  it('음수는 부호를 앞에 둔다', () => {
    expect(formatNumber(-1234.5, '#,##0.0')).toBe('-1,234.5')
  })
})
