/**
 * 예외를 사람이 읽을 문구로 — catch (e: any) 없이 메시지를 뽑기 위한 공용 헬퍼.
 * Error 면 message, 문자열이면 그대로, 그 외에는 JSON/문자열로 최선을 다한다.
 */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
    try {
      return JSON.stringify(e)
    } catch {
      /* 순환 참조 등 — 아래 기본 문구로 */
    }
  }
  return String(e ?? '알 수 없는 오류')
}
