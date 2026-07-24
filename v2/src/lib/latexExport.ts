/**
 * HTML(에디터 문서) → LaTeX 변환 — Overleaf 로 바로 가져갈 수 있는 .tex 생성.
 * 지원: 제목 계층, 굵게/기울임/밑줄/코드/취소선, 위·아래 첨자, 링크, 목록,
 * 인용구, 표(tabular), 수식($..$/equation+label), 그림·표 캡션, 상호참조(\ref),
 * 각주 표식, 특수문자 이스케이프.
 */

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

function refLabel(refType: string | null, key: string): string {
  const p = refType === 'fig' ? 'fig' : refType === 'tab' ? 'tab' : 'eq'
  return `${p}:${(key || 'x').replace(/[^a-zA-Z0-9]/g, '')}`
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent || '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const kids = () => [...el.childNodes].map(inline).join('')

  if (el.hasAttribute('data-math')) {
    const latex = el.getAttribute('latex') || el.getAttribute('data-latex') || ''
    return `$${latex}$`
  }
  if (el.hasAttribute('data-paper-tag')) {
    const kind = el.getAttribute('data-paper-tag')
    const key = el.getAttribute('data-key') || ''
    const refType = el.getAttribute('data-ref-type')
    if (kind === 'eqnum') return '' // equation 환경의 \label 로 대체됨
    if (kind === 'figlabel' || kind === 'tablabel') return '' // \caption 으로 대체
    if (kind === 'ref') {
      if (refType === 'eq') return `\\eqref{${refLabel('eq', key)}}`
      return `${refType === 'fig' ? 'Fig.~' : 'Table~'}\\ref{${refLabel(refType, key)}}`
    }
    return ''
  }

  switch (tag) {
    case 'strong': case 'b': return `\\textbf{${kids()}}`
    case 'em': case 'i': return `\\textit{${kids()}}`
    case 'u': return `\\underline{${kids()}}`
    case 's': case 'del': return `\\sout{${kids()}}`
    case 'code': return `\\texttt{${kids()}}`
    case 'sup': return `\\textsuperscript{${kids()}}`
    case 'sub': return `\\textsubscript{${kids()}}`
    case 'a': return `\\href{${(el.getAttribute('href') || '').replace(/[%#]/g, '\\$&')}}{${kids()}}`
    case 'br': return ' \\\\ '
    case 'img': return `% [이미지: ${esc(el.getAttribute('alt') || el.getAttribute('src')?.slice(0, 40) || 'image')}] \\includegraphics[width=\\linewidth]{IMAGE}`
    default: return kids()
  }
}

function tableToLatex(table: HTMLTableElement): string {
  const rows = [...table.querySelectorAll('tr')]
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.children.length))
  const spec = Array(cols).fill('l').join(' | ')
  const body = rows
    .map((r) => [...r.children].map((c) => inline(c).trim()).join(' & ') + ' \\\\')
    .join('\n')
  return `\\begin{center}\n\\begin{tabular}{| ${spec} |}\n\\hline\n${body}\n\\hline\n\\end{tabular}\n\\end{center}`
}

function blockToLatex(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  const paperBlock = el.getAttribute('data-paper-block')
  const key = el.getAttribute('data-paper-key') || ''

  if (paperBlock === 'eq') {
    const math = el.querySelector('[data-math]')
    const latex = math?.getAttribute('latex') || math?.getAttribute('data-latex') || ''
    return `\\begin{equation}\n${latex}\n\\label{${refLabel('eq', key)}}\n\\end{equation}`
  }
  if (paperBlock === 'figcap') {
    const text = [...el.childNodes].filter((n) => !(n as HTMLElement).getAttribute?.('data-paper-tag')).map(inline).join('').trim()
    return `\\begin{figure}[htbp]\n\\centering\n%\\includegraphics[width=0.8\\linewidth]{IMAGE}\n\\caption{${text}}\n\\label{${refLabel('fig', key)}}\n\\end{figure}`
  }
  if (paperBlock === 'tabcap') {
    const text = [...el.childNodes].filter((n) => !(n as HTMLElement).getAttribute?.('data-paper-tag')).map(inline).join('').trim()
    return `% 표 캡션 — 아래 표 환경과 결합하세요\n\\begin{table}[htbp]\n\\caption{${text}}\n\\label{${refLabel('tab', key)}}\n\\end{table}`
  }

  switch (tag) {
    case 'h1': return `\\section{${inline(el)}}`
    case 'h2': return `\\subsection{${inline(el)}}`
    case 'h3': return `\\subsubsection{${inline(el)}}`
    case 'h4': case 'h5': case 'h6': return `\\paragraph{${inline(el)}}`
    case 'p': { const t = inline(el).trim(); return t ? t : '' }
    case 'blockquote': return `\\begin{quote}\n${[...el.children].map((c) => blockToLatex(c as HTMLElement)).filter(Boolean).join('\n')}\n\\end{quote}`
    case 'pre': return `\\begin{verbatim}\n${el.textContent || ''}\n\\end{verbatim}`
    case 'ul': return `\\begin{itemize}\n${[...el.children].map((li) => `  \\item ${inline(li).trim()}`).join('\n')}\n\\end{itemize}`
    case 'ol': return `\\begin{enumerate}\n${[...el.children].map((li) => `  \\item ${inline(li).trim()}`).join('\n')}\n\\end{enumerate}`
    case 'table': return tableToLatex(el as HTMLTableElement)
    case 'hr': return el.getAttribute('data-page-break') ? '\\newpage' : '\\noindent\\rule{\\linewidth}{0.4pt}'
    case 'figure': case 'div': return [...el.children].map((c) => blockToLatex(c as HTMLElement)).filter(Boolean).join('\n\n')
    default: { const t = inline(el).trim(); return t }
  }
}

export function htmlToLatex(html: string, title: string): string {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r') as HTMLElement
  const body = [...root.children].map((c) => blockToLatex(c as HTMLElement)).filter(Boolean).join('\n\n')
  return `% ${title} — JustANotepad 에서 내보냄
% Overleaf 등에서 바로 컴파일할 수 있는 기본 골격입니다.
\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{kotex} % 한국어 (TeX Live: ko.TeX)
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage[normalem]{ulem}
\\usepackage{hyperref}
\\title{${esc(title)}}
\\date{}

\\begin{document}
\\maketitle

${body}

\\end{document}
`
}

export function downloadLatex(html: string, title: string): void {
  const tex = htmlToLatex(html, title)
  const blob = new Blob([tex], { type: 'application/x-tex;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(title || 'paper').replace(/[\\/:*?"<>|]/g, '_')}.tex`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}
