import { Extension, Node } from '@tiptap/core'

/**
 * 심어 둔 목록 표시 — 목차·색인·참고 문헌처럼 「우리가 만들어 넣은 줄」에 붙는 이름표.
 *
 * 워드는 이런 것을 필드로 심어 F9 로 새로 고친다. 우리는 만든 줄마다 data-jan-field 를
 * 달아 두고, 「고쳐 넣기」 를 누르면 같은 이름표를 가진 줄만 걷어 내고 다시 만든다.
 * (감싸는 div 로 하려 했지만 문서 구조에 div 가 없어 저장할 때 벗겨진다 — 줄에 붙여야 남는다)
 */

export const FIELD_TYPES = ['paragraph', 'heading']

/**
 * 쪽 칸 — 목차·색인·근거 목차의 오른쪽 끝에 앉는 쪽 번호.
 *
 * <span class="jan-toc-page">5</span> 로 넣었더니 class 도 span 도 문서 구조에 없어
 * 저장·재파싱에서 통째로 벗겨졌다. 남는 것은 알맹이 글자뿐이라 «제1장 제목» 뒤에
 * 숫자가 그대로 달라붙어 «제1장 제목5» 가 되고, 사이를 잇던 점선(leader)도 사라졌다.
 * 그러니 진짜 노드여야 한다. 사람이 고쳐 쓸 것이 아니므로 원자(atom)로 둔다 —
 * 워드가 쪽 번호를 필드로 심어 두는 것과 같다.
 *
 * 번호는 attrs 에만 담긴다. 그래서 쪽이 밀렸을 때 attrs 만 갈아 끼우면
 * 문서 크기가 그대로라 쪽 나눔이 다시 흔들리지 않는다.
 */
export const FieldPageNum = Node.create({
  name: 'janFieldPage',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (el: HTMLElement) => (el.textContent || '').trim(),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-jan-page-num]' }]
  },

  renderHTML({ node }) {
    return ['span', { 'data-jan-page-num': '1', class: 'jan-toc-page' }, String(node.attrs.text ?? '')]
  },
})

export const FieldBlocks = Extension.create({
  name: 'janFieldBlocks',
  addGlobalAttributes() {
    return [
      {
        types: FIELD_TYPES,
        attributes: {
          janField: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-field') || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              (attrs.janField ? { 'data-jan-field': String(attrs.janField) } : {}),
          },
          /**
           * 이 줄이 목록에서 맡은 몫 — 지금은 'head'(머리글) 하나뿐이다.
           *
           * 참고 문헌·미주는 매달린 들여쓰기를 쓰는데, 그 조판을 class 에 걸어 두었더니
           * class 가 저장·재파싱에서 벗겨져 들여쓰기가 아예 걸리지 않았다 (실측: text-indent 0px).
           * 목차 쪽 번호와 같은 뿌리라, 같은 수 — 살아남는 data-* 속성 — 를 쓴다.
           */
          janFieldRole: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-field-role') || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              (attrs.janFieldRole ? { 'data-jan-field-role': String(attrs.janFieldRole) } : {}),
          },
          /**
           * 「고쳐야 함」 — 심어 둔 목록이 지금 문서와 어긋났다는 표시.
           *
           * 쪽 번호는 스스로 따라가지만(attrs 만 바꾸므로 안전하다), 제목이 늘거나 이름이 바뀌면
           * 줄 자체를 다시 만들어야 한다. 그것은 문서 크기를 바꾸는 일이라 조용히 할 수 없다 —
           * 되돌리기에 남고 쪽 나눔을 다시 흔든다. 그래서 워드가 회색 음영으로 알리듯 눈에 띄게 알린다.
           */
          janStale: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-jan-stale') || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              (attrs.janStale ? { 'data-jan-stale': String(attrs.janStale) } : {}),
          },
        },
      },
    ]
  },
})
