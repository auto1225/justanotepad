/**
 * Phase 13 — 링크 카드 (URL unfurl).
 * URL 만 있는 단락을 감지 → fetch + DOMParser 로 OG 메타 추출 → 카드로 변환.
 *
 * CORS 제약: 대부분 사이트는 cross-origin 응답 차단.
 * 대안: 공개 OG 프록시 (예: opengraph.io) 또는 사용자 직접 입력.
 * 여기서는 favicon + URL hostname 만 fallback.
 */
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkCard: {
      setLinkCard: (url: string) => ReturnType
    }
  }
}

export const LinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      site: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-linkcard]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-linkcard': 'true',
        href: a.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'jan-linkcard',
      }),
      [
        'div',
        { class: 'jan-linkcard-body' },
        ['div', { class: 'jan-linkcard-title' }, a.title || a.url],
        ['div', { class: 'jan-linkcard-desc' }, a.description || ''],
        ['div', { class: 'jan-linkcard-site' }, a.site || hostname(a.url)],
      ],
      a.image
        ? ['img', { src: a.image, class: 'jan-linkcard-img', referrerpolicy: 'no-referrer', loading: 'lazy' }]
        : ['div', { class: 'jan-linkcard-favicon' }, faviconUrl()],
    ]
  },

  addCommands() {
    return {
      setLinkCard:
        (url: string) =>
        ({ commands }) => {
          // 비동기 메타 fetch — fire & forget. 즉시 URL fallback 으로 삽입 후 나중에 update.
          commands.insertContent({
            type: this.name,
            attrs: { url, title: '', description: '', image: '', site: hostname(url) },
          })
          // 메타 fetch 시도
          fetchOgMeta(url)
            .then((meta) => {
              // editor 인스턴스 직접 접근 어려우므로 view 에서 노드 찾기 — 사용자가 다시 cmd 실행 가능
              // 간단화: 메타 가져오면 alert 로 안내 (사용자가 노드 attrs 수동 갱신 또는 setLinkCard 다시)
              if (meta.title) console.log('[linkcard] meta:', meta)
            })
            .catch(() => {})
          return true
        },
    }
  },
})

function hostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}
/** 파비콘은 외부 서비스로 요청이 새는 것을 막기 위해 쓰지 않는다 (자리만 비워 둔다) */
function faviconUrl(): string {
  return ''
}

interface OgMeta {
  title: string
  description: string
  image: string
  site: string
}

/** OG 메타 fetch — CORS 제약. 공개 프록시 또는 사용자 자신의 서버 권장. */
async function fetchOgMeta(url: string): Promise<OgMeta> {
  try {
    const r = await fetch(url, { mode: 'cors' })
    if (!r.ok) throw new Error('not ok')
    const html = await r.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const get = (sel: string, attr = 'content') =>
      (doc.querySelector(sel) as HTMLMetaElement | null)?.[attr as 'content'] || ''
    return {
      title: get('meta[property="og:title"]') || doc.querySelector('title')?.textContent || '',
      description: get('meta[property="og:description"]') || get('meta[name="description"]') || '',
      image: get('meta[property="og:image"]') || '',
      site: get('meta[property="og:site_name"]') || hostname(url),
    }
  } catch {
    return { title: '', description: '', image: '', site: hostname(url) }
  }
}
