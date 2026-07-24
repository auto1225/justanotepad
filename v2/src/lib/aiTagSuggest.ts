/**
 * Phase 13 — AI 자동 태그 추천.
 * 메모 본문 → AI 가 3-5 개 태그 제안.
 */
import { runAi } from './aiApi'

export async function suggestTags(html: string): Promise<string[]> {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
  if (text.length < 20) return []

  const prompt = `다음 메모의 핵심 주제를 나타내는 한국어 태그 3~5개를 추천하세요.
- 단어 1~2글자 X (의미 있는 단어)
- 띄어쓰기 X (필요하면 dash 로 연결)
- 영어 약어 OK
- JSON 만 반환: {"tags":["태그1","태그2","태그3"]}

메모:
${text}`

  const r = await runAi('raw', prompt)
  // summarize prompt 는 한국어 5줄 요약이라 우리 프롬프트 우선되도록 새 mode 가 더 좋지만,
  // 임시로 실행 후 JSON 추출.
  if (!r.ok || !r.text) throw new Error(r.error || 'AI 응답 없음')
  return parseTagsFromText(r.text)
}

/** JSON 또는 평문에서 태그 추출. */
export function parseTagsFromText(text: string): string[] {
  // JSON 블록 우선
  const jsonMatch = text.match(/\{[^}]*"tags"\s*:\s*\[[^\]]+\][^}]*\}/)
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0])
      if (Array.isArray(data.tags)) return data.tags.slice(0, 6).map(String)
    } catch {}
  }
  // 평문에서 # 또는 따옴표 패턴
  const tags: string[] = []
  const reHash = /#([\p{L}\p{N}_-]+)/gu
  let m
  while ((m = reHash.exec(text)) !== null) tags.push(m[1])
  if (tags.length > 0) return tags.slice(0, 5)
  // 마지막 fallback: 콤마/줄 분리
  return text
    .replace(/[\[\]"]/g, '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 16)
    .slice(0, 5)
}
