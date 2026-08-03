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
        },
      },
    ]
  },
})
