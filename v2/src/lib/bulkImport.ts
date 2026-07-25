/**
 * Phase 13 — Markdown 일괄 import.
 * 사용자가 다수의 .md 파일 선택 → 각 파일을 별도 메모로 추가.
 * 첫 줄 # 제목이 있으면 메모 제목으로 사용.
 */
import { mdToHtml } from './markdownIO'
import { useMemosStore } from '../store/memosStore'
import { errText } from './errText'

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importMarkdownFiles(files: File[]): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const store = useMemosStore.getState()

  for (const f of files) {
    try {
      const text = await f.text()
      if (!text.trim()) { result.skipped++; continue }
      const titleMatch = text.match(/^#\s+(.+)$/m)
      const title = titleMatch?.[1]?.trim() || f.name.replace(/\.md$/i, '') || '무제'
      // 제목 라인 제거 후 변환 (메모 자체가 제목 필드를 가짐)
      const body = titleMatch ? text.slice(text.indexOf(titleMatch[0]) + titleMatch[0].length) : text
      const html = mdToHtml(body)

      const id = store.newMemo()
      useMemosStore.setState((s) => {
        const cur = s.memos[id]
        if (!cur) return s
        const next = { ...cur, title, content: html, updatedAt: Date.now() }
        return { memos: { ...s.memos, [id]: next } }
      })
      result.imported++
    } catch (e) {
      result.errors.push(`${f.name}: ${errText(e)}`)
    }
  }
  return result
}
