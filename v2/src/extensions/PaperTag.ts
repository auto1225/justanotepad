import { Extension, Node, mergeAttributes } from '@tiptap/core'

/**
 * 논문 번호·상호참조 시스템 (Overleaf \label/\ref 상당).
 *
 * PaperTag — 인라인 원자 노드. 종류:
 *   eqnum    수식 번호  "(3)"
 *   figlabel 그림 캡션 라벨 "Fig. 2."
 *   tablabel 표 캡션 라벨   "Table 1."
 *   ref      상호참조: refType(eq|fig|tab) + refKey 로 대상 지정
 *
 * 번호(n)는 attrs 로 보존되고, renumberPaperTags 가 문서 순서대로
 * 다시 계산해 참조까지 동기화한다. key 는 대상 식별용 고정 id.
 */
export type PaperTagKind = 'eqnum' | 'figlabel' | 'tablabel' | 'ref'
export type PaperRefType = 'eq' | 'fig' | 'tab'

/**
 * 캡션 이름(라벨) — 워드 「캡션 › 레이블」, 한글 「캡션 달기 › 번호 종류」 와 같은 자리.
 *
 * 라벨이 «Fig.»·«Table» 로 박혀 있으면 한국어 문서에서 그림 목차는 「그림 n.」 이라 적는데
 * 캡션은 「Fig. n.」 이라 적어 한 문서에 이름이 두 가지가 된다. 그래서
 *   하나. 라벨 낱말을 노드 속성(data-label)에 담아 문서가 스스로 제 이름을 지니게 하고,
 *   둘.  속성이 없는 예전 캡션은 문서 설정(기본 한국어)을 따르게 한다.
 * 목차·상호 참조도 모두 이 낱말을 쓰므로 문서 안에서 이름이 갈라지지 않는다.
 */
export type CaptionLang = 'ko' | 'en'

export const CAPTION_LANGS: Array<{ key: CaptionLang; label: string; hint: string }> = [
  { key: 'ko', label: '한국어', hint: '그림 1. · 표 1.' },
  { key: 'en', label: '영어', hint: 'Fig. 1. · Table 1.' },
]

const LANG_WORDS: Record<CaptionLang, { fig: string; tab: string }> = {
  ko: { fig: '그림', tab: '표' },
  en: { fig: 'Fig.', tab: 'Table' },
}

const LANG_KEY = 'jan-v2-caption-lang'
let 새김된말 : CaptionLang | null = null

/** 문서 설정 — 라벨을 어느 말로 적을지 (기본 한국어) */
export function captionLang(): CaptionLang {
  if (새김된말) return 새김된말
  try {
    const v = localStorage.getItem(LANG_KEY)
    새김된말 = v === 'en' ? 'en' : 'ko'
  } catch {
    새김된말 = 'ko'
  }
  return 새김된말
}

export function rememberCaptionLang(lang: CaptionLang): void {
  새김된말 = lang
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* 저장이 막혀도 이 세션은 쓴다 */ }
}

/** 이 갈래가 쓰는 라벨 낱말 (그림 · 표 …) */
export function captionWord(kind: PaperTagKind, refType: PaperRefType | null, lang = captionLang()): string {
  const words = LANG_WORDS[lang] || LANG_WORDS.ko
  if (kind === 'figlabel' || refType === 'fig') return words.fig
  if (kind === 'tablabel' || refType === 'tab') return words.tab
  return ''
}

export function paperTagLabel(kind: PaperTagKind, refType: PaperRefType | null, n: number, label?: string | null): string {
  if (kind === 'eqnum') return `(${n})`
  const word = label || captionWord(kind, refType)
  if (kind === 'figlabel' || kind === 'tablabel') return `${word} ${n}.`
  // ref
  if (refType === 'fig' || refType === 'tab') return `${word} ${n}`
  return `(${n})`
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paperTag: {
      insertPaperTag: (attrs: { kind: PaperTagKind; refType?: PaperRefType | null; refKey?: string; n?: number; label?: string | null }) => ReturnType
    }
  }
}

export const PaperTag = Node.create({
  name: 'paperTag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: {
        default: 'ref',
        parseHTML: (el) => el.getAttribute('data-paper-tag') || 'ref',
        renderHTML: () => ({}),
      },
      refType: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-ref-type'),
        renderHTML: () => ({}),
      },
      refKey: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-key') || '',
        renderHTML: () => ({}),
      },
      n: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute('data-n')) || 1,
        renderHTML: () => ({}),
      },
      /** 라벨 낱말 — 없으면 문서 설정(captionLang)을 따른다 */
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label') || null,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-paper-tag]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as PaperTagKind
    const refType = (node.attrs.refType ?? null) as PaperRefType | null
    const n = Number(node.attrs.n) || 1
    const label = (node.attrs.label ?? null) as string | null
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-paper-tag': kind,
        'data-ref-type': refType || undefined,
        'data-key': node.attrs.refKey || undefined,
        'data-n': String(n),
        'data-label': label || undefined,
        class: 'jan-paper-tag jan-paper-tag-' + kind,
      }),
      paperTagLabel(kind, refType, n, label),
    ]
  },

  addCommands() {
    return {
      insertPaperTag:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { kind: attrs.kind, refType: attrs.refType ?? null, refKey: attrs.refKey ?? '', n: attrs.n ?? 1, label: attrs.label ?? null } })
            .run(),
    }
  },
})

/**
 * 문단에 논문 블록 속성(data-paper-block, data-paper-key)을 허용 —
 * 수식 문단(eq)·그림 캡션(figcap)·표 캡션(tabcap)을 구분해 CSS 로 조판.
 */
export const PaperBlockAttrs = Extension.create({
  name: 'paperBlockAttrs',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          'data-paper-block': {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-paper-block'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs['data-paper-block'] ? { 'data-paper-block': attrs['data-paper-block'] } : {},
          },
          'data-paper-key': {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-paper-key'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs['data-paper-key'] ? { 'data-paper-key': attrs['data-paper-key'] } : {},
          },
        },
      },
    ]
  },
})
