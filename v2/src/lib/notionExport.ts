/**
 * Phase 15 — Notion 호환 ZIP export.
 * 각 메모를 별도 .md 파일로 + index.md 목차 + ZIP.
 * Notion 의 "Markdown & CSV import" 와 호환되는 폴더 구조.
 */
import JSZip from 'jszip'
import { resolveBlobRefsInHtml } from './blobRefs'
import { htmlToMd } from './markdownIO'
import { useMemosStore } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'

export async function exportNotionZip(): Promise<Blob> {
  const memos = Object.values(useMemosStore.getState().memos)
  const tagsByMemo = useTagsStore.getState().byMemo

  const zip = new JSZip()
  const folder = zip.folder('JustANotepad-export')!

  // 파일명을 먼저 확정해 index 링크와 실제 파일이 항상 일치하게 한다
  // (같은 제목이 여럿이면 -2, -3 으로 중복 회피 — 예전엔 index 가 첫 파일만 가리켰다)
  const usedNames = new Set<string>()
  const fileNameByMemo = new Map<string, string>()
  for (const m of memos) {
    let name = slug(m.title) || m.id
    let n = 1
    while (usedNames.has(name)) {
      name = (slug(m.title) || m.id) + '-' + ++n
    }
    usedNames.add(name)
    fileNameByMemo.set(m.id, name)
  }

  // index.md
  let index = '# JustANotepad export\n\n'
  index += `생성: ${new Date().toLocaleString('ko-KR')}\n\n`
  index += `메모 ${memos.length}개\n\n`
  index += '## 목차\n\n'
  for (const m of memos) {
    index += `- [${m.title || '무제'}](./${fileNameByMemo.get(m.id)}.md)\n`
  }
  folder.file('index.md', index)

  // 각 메모 .md
  for (const m of memos) {
    const name = fileNameByMemo.get(m.id)!

    const tags = tagsByMemo[m.id] || []
    let md = `# ${m.title || '무제'}\n\n`
    md += `<!-- 생성: ${new Date(m.createdAt).toISOString()} | 수정: ${new Date(m.updatedAt).toISOString()} -->\n\n`
    if (tags.length > 0) {
      md += `Tags: ${tags.map((t) => '#' + t).join(' ')}\n\n`
    }
    md += htmlToMd(await resolveBlobRefsInHtml(m.content))
    folder.file(name + '.md', md)
  }

  return zip.generateAsync({ type: 'blob' })
}

function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\u00C0-\uFFFF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export async function downloadNotionZip(): Promise<void> {
  const blob = await exportNotionZip()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `justanotepad-export-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
