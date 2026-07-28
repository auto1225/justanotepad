import { Mark, Node, mergeAttributes } from '@tiptap/core'

/**
 * 메모(주석)와 누름틀 —
 *  · 메모: 워드 「삽입 › 메모(Ctrl+Alt+M)」. 고른 글에 붙는 표시 + 옆에 뜨는 목록.
 *  · 누름틀: 한글 「입력 › 필드 입력(누름틀)」. 「여기에 이름을 쓴다」 같은
 *    안내문이 자리를 지키다가, 누르면 그 자리에 바로 쓰게 되는 칸.
 *    계약서·기안문 서식을 웹으로 돌릴 때 워드의 콘텐츠 컨트롤보다 훨씬 눈에 띈다.
 */

/* ── 메모 (주석) ───────────────────────────────────────── */

export const CommentMark = Mark.create({
  name: 'janComment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      id: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id') || '' },
      text: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-comment') || '' },
      author: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-by') || '' },
      at: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-at') || '' },
      done: { default: false, parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-done') === '1' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ mark }) {
    const a = mark.attrs as Record<string, unknown>
    return [
      'span',
      mergeAttributes({
        'data-comment-id': String(a.id || ''),
        'data-comment': String(a.text || ''),
        'data-comment-by': String(a.author || ''),
        'data-comment-at': String(a.at || ''),
        ...(a.done ? { 'data-comment-done': '1' } : {}),
        class: a.done ? 'jan-comment is-done' : 'jan-comment',
        title: String(a.text || ''),
      }),
      0,
    ]
  },
})

/* ── 누름틀 (필드) ────────────────────────────────────── */

export const FieldInput = Node.create({
  name: 'janField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      /** 안내문 — 아직 채우지 않았을 때 붉게 보인다 */
      guide: { default: '내용을 쓴다', parseHTML: (el: HTMLElement) => el.getAttribute('data-guide') || '' },
      /** 채운 값 */
      value: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-value') || '' },
      /** 작성 지침 — 마우스를 올리면 뜬다 (한글의 메모) */
      memo: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-memo') || '' },
      name: { default: '', parseHTML: (el: HTMLElement) => el.getAttribute('data-name') || '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-field]' }]
  },

  renderHTML({ node }) {
    const a = node.attrs as Record<string, string>
    const filled = !!a.value
    return [
      'span',
      {
        'data-jan-field': '1',
        'data-guide': a.guide || '',
        'data-value': a.value || '',
        'data-memo': a.memo || '',
        'data-name': a.name || '',
        class: filled ? 'jan-field is-filled' : 'jan-field',
        title: a.memo || '누르면 이 자리에 쓴다',
      },
      filled ? a.value : `〔${a.guide}〕`,
    ]
  },
})
