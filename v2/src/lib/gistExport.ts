/**
 * Phase 16 — GitHub Gist 내보내기.
 * 사용자 PAT (personal access token, gist scope 만 필요) 로 Gist API 호출.
 * 메모 1개 → 1 Gist (.md 파일).
 */
import { htmlToMd } from './markdownIO'
import { errText } from './errText'

export interface GistResult {
  ok: boolean
  url?: string
  rawUrl?: string
  error?: string
}

interface GistOptions {
  token: string
  isPublic: boolean
  filename: string
  content: string
  description?: string
}

export async function createGist(opts: GistOptions): Promise<GistResult> {
  try {
    const r = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + opts.token,
      },
      body: JSON.stringify({
        description: opts.description || '',
        public: opts.isPublic,
        files: { [opts.filename]: { content: opts.content } },
      }),
    })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return { ok: false, error: `GitHub ${r.status}: ${err.slice(0, 250)}` }
    }
    const data = await r.json()
    const file = Object.values(data.files || {})[0] as { raw_url?: string } | undefined
    return { ok: true, url: data.html_url, rawUrl: file?.raw_url }
  } catch (e) {
    return { ok: false, error: '네트워크 오류: ' + errText(e) }
  }
}

/** 현재 메모 (HTML) 를 Markdown 으로 변환해서 Gist 생성. */
export async function createGistFromMemo(
  token: string,
  isPublic: boolean,
  title: string,
  html: string
): Promise<GistResult> {
  const md = `# ${title || '무제'}\n\n${htmlToMd(html)}`
  const filename = (title.replace(/[^a-zA-Z0-9가-힣\s-]/g, '').trim().slice(0, 60) || 'memo') + '.md'
  return createGist({
    token,
    isPublic,
    filename,
    content: md,
    description: 'Exported from JustANotepad v2',
  })
}
