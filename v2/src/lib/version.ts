/**
 * 이 앱의 판 번호 — 여기 한 곳에서만 정한다.
 *
 * 곳곳에 숫자를 적어 두면 어디는 2.0.0, 어디는 1.0.34 가 되어 사람도 우리도 헷갈린다.
 * (실제로 「앱 정보」 창에는 2.0.0 이 박혀 있었고 화면 어디에도 판 번호가 없었다.)
 *
 * 적는 꼴: V<큰 자리>.<작은 자리 세 자리>   보기) V1.001 · V1.012 · V2.000
 *  · 고침 하나를 내보낼 때마다 작은 자리를 1 올린다 (V1.001 → V1.002)
 *  · 쓰는 방식이 달라질 만큼 크게 바뀌면 큰 자리를 올리고 작은 자리를 000 으로 되돌린다
 *
 * 올릴 때는 이 파일만 고치면 상태줄과 「앱 정보」 가 함께 따라간다.
 */
export const APP_VERSION = 'V1.007'

/** 판 번호를 숫자로 견주어야 할 때 (V1.012 → { major: 1, minor: 12 }) */
export function parseVersion(v: string = APP_VERSION): { major: number; minor: number } {
  const m = /^V(\d+)\.(\d+)$/.exec(v.trim())
  if (!m) return { major: 0, minor: 0 }
  return { major: Number(m[1]), minor: Number(m[2]) }
}
