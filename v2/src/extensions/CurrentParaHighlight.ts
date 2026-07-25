import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * 현재 문단 하이라이트 — 커서가 있는 최상위 블록에 .jan-current-para 데코레이션.
 *
 * DOM classList 직접 조작은 ProseMirror 가 selection 근처 노드를 재렌더하며
 * 노드 자체를 교체할 때 소실된다 → node decoration 으로 렌더 사이클과 통합.
 * 활성 여부는 body.jan-para-focus 로 판단 (uiStore.paragraphFocus 가 토글).
 */
export const CurrentParaHighlight = Extension.create({
  name: 'currentParaHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('jan-current-para'),
        props: {
          decorations(state) {
            if (typeof document === 'undefined' || !document.body.classList.contains('jan-para-focus')) return null
            const { $head } = state.selection
            if ($head.depth < 1) return null
            // 독립 페이지 모델에서는 depth 1 이 page 노드다 — 문단(텍스트블록)이 있는
            // 깊이를 찾아 그 블록만 강조한다 (페이지 전체가 강조되면 의미가 없다)
            let depth = $head.depth
            while (depth > 1 && !$head.node(depth).isTextblock) depth--
            const from = $head.before(depth)
            const node = state.doc.nodeAt(from)
            if (!node) return null
            return DecorationSet.create(state.doc, [
              Decoration.node(from, from + node.nodeSize, { class: 'jan-current-para' }),
            ])
          },
        },
      }),
    ]
  },
})
