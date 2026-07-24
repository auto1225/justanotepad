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

export function paperTagLabel(kind: PaperTagKind, refType: PaperRefType | null, n: number): string {
  if (kind === 'eqnum') return `(${n})`
  if (kind === 'figlabel') return `Fig. ${n}.`
  if (kind === 'tablabel') return `Table ${n}.`
  // ref
  if (refType === 'fig') return `Fig. ${n}`
  if (refType === 'tab') return `Table ${n}`
  return `(${n})`
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paperTag: {
      insertPaperTag: (attrs: { kind: PaperTagKind; refType?: PaperRefType | null; refKey?: string; n?: number }) => ReturnType
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
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-paper-tag]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as PaperTagKind
    const refType = (node.attrs.refType ?? null) as PaperRefType | null
    const n = Number(node.attrs.n) || 1
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-paper-tag': kind,
        'data-ref-type': refType || undefined,
        'data-key': node.attrs.refKey || undefined,
        'data-n': String(n),
        class: 'jan-paper-tag jan-paper-tag-' + kind,
      }),
      paperTagLabel(kind, refType, n),
    ]
  },

  addCommands() {
    return {
      insertPaperTag:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { kind: attrs.kind, refType: attrs.refType ?? null, refKey: attrs.refKey ?? '', n: attrs.n ?? 1 } })
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
