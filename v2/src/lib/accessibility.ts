import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { flash } from './flash'
import { insertFigureCaption, renumberPaperTags } from './paperRefs'

/**
 * 접근성 검사 — 워드 「검토 › 접근성 검사」.
 *
 * 눈으로는 멀쩡해 보여도 화면 낭독기로 읽으면 막히는 곳들을 찾아 준다.
 * 그림에 설명이 없거나, 표에 머리글이 없거나, 제목 수준을 건너뛰었거나,
 * 글자와 바탕 색이 너무 비슷하거나 — 고칠 수 있는 것은 그 자리에서 고쳐 준다.
 */

export type A11yLevel = 'error' | 'warn' | 'info'
export type A11yFix = 'alt' | 'header' | 'caption' | 'none'

export interface A11yIssue {
  level: A11yLevel
  title: string
  detail: string
  /** 문서에서 문제가 있는 자리 (없으면 문서 전체에 대한 말) */
  pos?: number
  fix: A11yFix
}

const LEVEL_ORDER: Record<A11yLevel, number> = { error: 0, warn: 1, info: 2 }

/* ── 색 대비 ─────────────────────────────────────────── */

function parseColor(v: string): [number, number, number] | null {
  const s = v.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(s)
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]]
    }
  }
  return null
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** 글자색과 바탕색의 대비 (WCGA 기준 4.5:1 이상이어야 읽기 쉽다) */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseColor(fg)
  const b = parseColor(bg)
  if (!a || !b) return null
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 종이 바탕색 — 쪽 색을 바꿔 두었다면 그 색과 견준다 */
function paperColor(editor: Editor): string {
  if (editor.isDestroyed) return '#ffffff'
  const page = editor.view.dom.querySelector('[data-jan-page]') as HTMLElement | null
  const el = page || (editor.view.dom as HTMLElement)
  let node: HTMLElement | null = el
  while (node) {
    const bg = getComputedStyle(node).backgroundColor
    const c = parseColor(bg)
    if (c && !/rgba\([^)]*,\s*0\s*\)/.test(bg)) return bg
    node = node.parentElement
  }
  return '#ffffff'
}

/* ── 검사 ────────────────────────────────────────────── */

const VAGUE_LINK = ['여기', '이곳', '클릭', '링크', '바로가기', 'here', 'click', 'link', '더보기']

function tableHasHeader(table: PMNode): boolean {
  let found = false
  table.descendants((n) => { if (n.type.name === 'tableHeader') found = true })
  return found
}

function tableMerged(table: PMNode): boolean {
  let merged = false
  table.descendants((n) => {
    const a = n.attrs as Record<string, unknown>
    if ((Number(a.colspan) || 1) > 1 || (Number(a.rowspan) || 1) > 1) merged = true
  })
  return merged
}

/** 그림·차트 바로 뒤에 캡션이 붙어 있나 */
function hasCaptionAfter(doc: PMNode, pos: number, size: number): boolean {
  const $after = doc.resolve(Math.min(doc.content.size, pos + size))
  for (let d = $after.depth; d >= 0; d--) {
    const parent = $after.node(d)
    const index = $after.index(d)
    const next = index < parent.childCount ? parent.child(index) : null
    const cls = String((next?.attrs as Record<string, unknown> | undefined)?.class || '')
    if (next && /paper-(fig|tab)cap/.test(cls)) return true
  }
  return false
}

export function checkAccessibility(editor: Editor | null): A11yIssue[] {
  if (!editor) return []
  const out: A11yIssue[] = []
  const doc = editor.state.doc
  const bg = paperColor(editor)

  let headingCount = 0
  let topLevel = 0
  let lastLevel = 0
  let blankRun = 0
  let blankAt = -1

  doc.descendants((node, pos) => {
    const name = node.type.name
    const a = node.attrs as Record<string, unknown>

    if (name === 'heading') {
      headingCount++
      const level = Number(a.level) || 1
      if (!topLevel) topLevel = level
      if (!node.textContent.trim()) {
        out.push({ level: 'warn', title: '빈 제목', detail: '글이 없는 제목은 낭독기가 건너뛴다. 글을 넣거나 본문으로 바꾼다.', pos, fix: 'none' })
      }
      if (lastLevel && level > lastLevel + 1) {
        out.push({
          level: 'warn',
          title: `제목 수준을 건너뛰었다 (${lastLevel} → ${level})`,
          detail: '한 단계씩 내려가야 목차와 낭독기가 짜임새를 알아본다.',
          pos,
          fix: 'none',
        })
      }
      lastLevel = level
    }

    if (name === 'image') {
      if (!String(a.alt || '').trim()) {
        out.push({ level: 'error', title: '그림에 설명이 없다', detail: '눈으로 못 보는 사람에게 이 그림을 무엇이라 읽어 줄지 적는다.', pos, fix: 'alt' })
      }
    }

    if (name === 'janChart' || name === 'janSmart' || name === 'janModel3d' || name === 'janSignature') {
      /* 차트는 스스로 캡션 칸을 가진다 — 그것이 채워져 있으면 됐다 */
      const own = String(a.caption || '').trim()
      if (!own && !hasCaptionAfter(doc, pos, node.nodeSize)) {
        const what = name === 'janChart' ? '차트' : name === 'janSmart' ? '도해' : name === 'janModel3d' ? '3차원 모형' : '서명'
        out.push({ level: 'warn', title: `${what}에 캡션이 없다`, detail: '그림으로만 뜻이 전해지는 개체에는 캡션을 붙여 글로도 읽히게 한다.', pos, fix: 'caption' })
      }
    }

    if (name === 'table') {
      if (!tableHasHeader(node)) {
        out.push({ level: 'error', title: '표에 머리글 행이 없다', detail: '머리글이 있어야 낭독기가 각 칸이 무슨 값인지 알려 준다.', pos, fix: 'header' })
      }
      if (tableMerged(node)) {
        out.push({ level: 'info', title: '표에 합친 칸이 있다', detail: '합친 칸은 낭독 순서가 헷갈린다. 표를 둘로 나누면 읽기 쉽다.', pos, fix: 'none' })
      }
    }

    if (name === 'paragraph') {
      if (!node.textContent.trim() && node.childCount === 0) {
        if (blankRun === 0) blankAt = pos
        blankRun++
        if (blankRun === 3) {
          out.push({ level: 'info', title: '빈 줄로 자리를 벌렸다', detail: '빈 줄 대신 문단 여백(레이아웃 › 문단 간격)을 쓰면 낭독기가 헛읽지 않는다.', pos: blankAt, fix: 'none' })
        }
      } else {
        blankRun = 0
      }
    }

    if (node.isText) {
      const marks = node.marks
      const link = marks.find((m) => m.type.name === 'link')
      if (link) {
        const text = (node.text || '').trim()
        const href = String(link.attrs.href || '')
        if (VAGUE_LINK.some((w) => text.toLowerCase() === w) || /^https?:\/\//i.test(text)) {
          out.push({ level: 'warn', title: `링크 글이 뜻을 알려 주지 않는다 — "${text.slice(0, 20)}"`, detail: `어디로 가는 링크인지 글에 담는다 (지금: ${href.slice(0, 40)}).`, pos, fix: 'none' })
        }
      }
      const style = marks.find((m) => m.type.name === 'textStyle')
      const hl = marks.find((m) => m.type.name === 'highlight')
      const fg = String(style?.attrs.color || '')
      const back = String(hl?.attrs.color || '') || bg
      if (fg) {
        const ratio = contrastRatio(fg, back)
        if (ratio != null && ratio < 4.5) {
          out.push({
            level: 'warn',
            title: `글자와 바탕이 너무 비슷하다 (${ratio.toFixed(1)} : 1)`,
            detail: '4.5 : 1 보다 진해야 흐린 화면·인쇄에서도 읽힌다. 글자색을 더 진하게 한다.',
            pos,
            fix: 'none',
          })
        }
      }
      const size = Number(String(style?.attrs.fontSize || '').replace(/[^0-9.]/g, ''))
      if (size && size < 9) {
        out.push({ level: 'warn', title: `글자가 너무 작다 (${size}px)`, detail: '9px 아래는 확대 없이 읽기 어렵다.', pos, fix: 'none' })
      }
    }
  })

  if (!headingCount) {
    out.push({ level: 'info', title: '제목이 하나도 없다', detail: '제목을 붙이면 낭독기·목차가 문서의 뼈대를 알아본다.', fix: 'none' })
  } else if (topLevel > 1) {
    out.push({ level: 'info', title: '가장 큰 제목이 1수준이 아니다', detail: '문서의 큰 제목은 제목 1 로 두는 것이 표준이다.', fix: 'none' })
  }

  /* 같은 말이 스무 번 늘어서면 목록만 길어진다 — 세 곳까지 보여 주고 나머지는 수로 알린다 */
  const shown = new Map<string, number>()
  const more = new Map<string, number>()
  const merged: A11yIssue[] = []
  out.forEach((issue) => {
    const key = issue.title
    const n = (shown.get(key) || 0) + 1
    shown.set(key, n)
    if (n <= 3) merged.push(issue)
    else more.set(key, (more.get(key) || 0) + 1)
  })
  more.forEach((n, title) => {
    const sample = out.find((i) => i.title === title) as A11yIssue
    merged.push({ level: sample.level, title: `${title} — 그 밖에 ${n}곳`, detail: sample.detail, fix: 'none' })
  })

  return merged.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.pos ?? 0) - (b.pos ?? 0))
}

/** 문제가 있는 자리로 간다 */
export function gotoIssue(editor: Editor | null, issue: A11yIssue): boolean {
  if (!editor || issue.pos == null) return false
  const size = editor.state.doc.content.size
  const at = Math.max(0, Math.min(size - 1, issue.pos))
  editor.chain().focus().setTextSelection(at).scrollIntoView().run()
  return true
}

/** 고칠 수 있는 것은 그 자리에서 고친다 (그림 설명 · 표 머리글) */
export function fixIssue(editor: Editor | null, issue: A11yIssue, value?: string): boolean {
  if (!editor || issue.pos == null) return false
  const node = editor.state.doc.nodeAt(issue.pos)
  if (!node) return false

  if (issue.fix === 'alt') {
    const alt = (value || '').trim()
    if (!alt) return false
    editor.view.dispatch(editor.state.tr.setNodeMarkup(issue.pos, undefined, { ...node.attrs, alt }))
    flash('그림 설명을 넣었다')
    return true
  }

  if (issue.fix === 'header') {
    editor.chain().focus().setTextSelection(issue.pos + 2).toggleHeaderRow().run()
    flash('첫 줄을 머리글 행으로 바꿨다')
    return true
  }

  if (issue.fix === 'caption') {
    const text = (value || '').trim()
    if (!text) return false
    /* 캡션 칸을 가진 개체(차트)는 그 칸에 넣는다 — 개체와 함께 움직여야 한다 */
    if ('caption' in node.attrs) {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(issue.pos, undefined, { ...node.attrs, caption: text }))
      flash('캡션을 넣었다')
      return true
    }
    /* 그 밖에는 개체 바로 뒤에 캡션 줄을 넣는다 — 「그림 목차」 도 이 표시를 보고 모은다 */
    const after = Math.min(editor.state.doc.content.size, issue.pos + node.nodeSize)
    editor.chain().focus().setTextSelection(after).run()
    insertFigureCaption(editor, text)
    renumberPaperTags(editor)
    flash('캡션을 넣었다')
    return true
  }

  return false
}

/** 한 줄 요약 — 리본 단추에서 바로 알려 줄 때 쓴다 */
export function a11ySummary(issues: A11yIssue[]): string {
  const e = issues.filter((i) => i.level === 'error').length
  const w = issues.filter((i) => i.level === 'warn').length
  if (!issues.length) return '접근성 문제를 찾지 못했다'
  return `고쳐야 할 것 ${e}건 · 살펴볼 것 ${w}건`
}
