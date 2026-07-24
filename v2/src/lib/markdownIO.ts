/**
 * Phase 6 — TipTap HTML ↔ Markdown 변환.
 * Turndown.js / marked 추가 의존 없이 자체 구현 (간단/빠름).
 * 지원: heading, paragraph, bold, italic, underline, strike, link, image,
 *       blockquote, code(inline+block), list(ul/ol), table, hr.
 */

/** TipTap HTML → Markdown */
export function htmlToMd(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  function walk(node: Node, ctx: { listDepth: number; listType: 'ul' | 'ol'; ordIdx: number }): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const inner = (newCtx?: typeof ctx) =>
      Array.from(el.childNodes).map((n) => walk(n, newCtx || ctx)).join('')

    switch (tag) {
      case 'h1': return `\n# ${inner()}\n\n`
      case 'h2': return `\n## ${inner()}\n\n`
      case 'h3': return `\n### ${inner()}\n\n`
      case 'h4': return `\n#### ${inner()}\n\n`
      case 'h5': return `\n##### ${inner()}\n\n`
      case 'h6': return `\n###### ${inner()}\n\n`
      case 'p':  return `${inner()}\n\n`
      case 'br': return `  \n`
      case 'hr': return `\n---\n\n`
      case 'strong': case 'b': return `**${inner()}**`
      case 'em': case 'i': return `*${inner()}*`
      case 'u': return `<u>${inner()}</u>` // markdown 표준엔 없음 → HTML 유지
      case 's': case 'strike': case 'del': return `~~${inner()}~~`
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return inner()
        return `\`${inner()}\``
      case 'pre': {
        const code = el.querySelector('code')
        const txt = code ? code.textContent || '' : el.textContent || ''
        return `\n\`\`\`\n${txt}\n\`\`\`\n\n`
      }
      case 'blockquote':
        return inner().split('\n').map((l) => l ? `> ${l}` : l).join('\n') + '\n\n'
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${inner()}](${href})`
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return `![${alt}](${src})`
      }
      case 'ul': {
        const isTaskList = el.getAttribute('data-type') === 'taskList'
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === 'li')
          .map((li) => {
            const body = walk(li, { ...ctx, listDepth: ctx.listDepth + 1, listType: 'ul' }).trim()
            if (isTaskList || li.getAttribute('data-type') === 'taskItem') {
              // GFM 체크박스로 내보내야 체크 상태가 왕복에서 살아남는다
              const checked = li.getAttribute('data-checked') === 'true'
              return '  '.repeat(ctx.listDepth) + `- [${checked ? 'x' : ' '}] ` + body
            }
            return '  '.repeat(ctx.listDepth) + '- ' + body
          })
          .join('\n')
        return '\n' + items + '\n\n'
      }
      case 'ol': {
        let i = 1
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === 'li')
          .map((li) => '  '.repeat(ctx.listDepth) + `${i++}. ` + walk(li, { ...ctx, listDepth: ctx.listDepth + 1, listType: 'ol' }).trim())
          .join('\n')
        return '\n' + items + '\n\n'
      }
      case 'li':
        return Array.from(el.childNodes).map((n) => walk(n, ctx)).join('').trim()
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'))
        if (rows.length === 0) return ''
        const headerCells = Array.from(rows[0].cells).map((c) => (c.textContent || '').trim())
        const sep = headerCells.map(() => '---')
        const bodyRows = rows.slice(1).map((r) =>
          '| ' + Array.from(r.cells).map((c) => (c.textContent || '').trim()).join(' | ') + ' |'
        )
        return '\n| ' + headerCells.join(' | ') + ' |\n| ' + sep.join(' | ') + ' |\n' + bodyRows.join('\n') + '\n\n'
      }
      default:
        return inner()
    }
  }

  const md = walk(div, { listDepth: 0, listType: 'ul', ordIdx: 1 })
  return md.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** Markdown → HTML (TipTap 호환). marked 없이 간단 변환. */
export function mdToHtml(md: string): string {
  let s = md.replace(/\r\n/g, '\n')

  // Code blocks (먼저 추출하여 placeholder 로 보호)
  const blocks: string[] = []
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = blocks.length
    blocks.push(`<pre><code>${escapeHtml(code.replace(/^\n|\n$/g, ''))}</code></pre>`)
    return `\u0000BLK${idx}\u0000`
  })

  // Inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)

  // Headings
  s = s.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  s = s.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  s = s.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Hr
  s = s.replace(/^---+$/gm, '<hr>')

  // Bold / italic / strike
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>')

  // Image / link
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Task lists (- [ ] / - [x]) — 일반 리스트 규칙보다 먼저 처리해야 한다
  s = s.replace(/(?:^- \[[ xX]\] (.+)\n?)+/gm, (m) => {
    const items = m.trim().split('\n').map((l) => {
      const checked = /^- \[[xX]\]/.test(l)
      const text = l.replace(/^- \[[ xX]\] /, '')
      return `<li data-type="taskItem" data-checked="${checked}">${text}</li>`
    }).join('')
    return `<ul data-type="taskList">${items}</ul>\n`
  })

  // Lists (간단 — 들여쓰기 1단계)
  s = s.replace(/(?:^- (.+)\n?)+/gm, (m) => {
    const items = m.trim().split('\n').map((l) => `<li>${l.replace(/^- /, '')}</li>`).join('')
    return `<ul>${items}</ul>\n`
  })
  s = s.replace(/(?:^\d+\. (.+)\n?)+/gm, (m) => {
    const items = m.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')
    return `<ol>${items}</ol>\n`
  })

  // Blockquote
  s = s.replace(/(?:^> .*\n?)+/gm, (m) => {
    const inner = m.split('\n').map((l) => l.replace(/^> /, '')).join('\n').trim()
    return `<blockquote><p>${inner}</p></blockquote>\n`
  })

  // Paragraphs (남은 빈 줄 단락)
  s = s
    .split(/\n{2,}/)
    .map((para) => {
      const t = para.trim()
      if (!t) return ''
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|table|p)/i.test(t)) return t
      if (/^\u0000BLK\d+\u0000$/.test(t)) return t
      return `<p>${t.replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')

  // 코드 블록 복원
  s = s.replace(/\u0000BLK(\d+)\u0000/g, (_, i) => blocks[parseInt(i, 10)] || '')

  return s
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 다운로드 헬퍼. */
export function downloadMd(html: string, filename: string) {
  const md = htmlToMd(html)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/\.[^/.]+$/, '') + '.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
