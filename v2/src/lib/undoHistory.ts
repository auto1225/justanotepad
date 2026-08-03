import type { EditorState, Plugin, Transaction } from '@tiptap/pm/state'

/**
 * 문서를 「연」 것은 고친 것이 아니다 — 열면서 되돌리기 목록을 비운다.
 *
 * setContent 는 문서 전체를 갈아 끼우는 트랜잭션이다. 아무 표시가 없으면 그것이 그대로
 * 되돌리기 한 걸음으로 쌓인다. 그래서 강의 노트를 열고 Ctrl+Z 를 두 번 누르면 두 번째에
 * **직전에 보던 문서**(대개 빈 새 메모)가 돌아왔다 — 방금 연 글이 통째로 사라진 것처럼 보인다.
 * 워드·한글은 파일을 열면 되돌리기 목록을 비운다. 열기 전으로 돌아갈 길은 애초에 없어야 한다.
 *
 * prosemirror-history 에는 「비우기」 명령이 없다. 다만 제 열쇠로 온 쪽지가 트랜잭션에 붙어
 * 있으면 그 안에 든 이력을 그대로 받아 쓴다. 그 자리에 갓 만든 빈 이력을 얹는다 —
 * 플러그인이 처음 제 상태를 만들 때 쓰는 그 함수를 그대로 불러서 만든다.
 */
export function clearUndoHistory(tr: Transaction, state: EditorState): boolean {
  /* 이력 플러그인은 제 열쇠를 밖으로 내주지 않는다 — 열쇠 이름으로 찾는다 (PluginKey('history')) */
  const plugin = state.plugins.find((p) =>
    String((p as unknown as { key?: string }).key).startsWith('history$')
  ) as Plugin | undefined
  const field = plugin?.spec?.state
  if (!plugin || !field) return false
  tr.setMeta(plugin, { historyState: field.init.call(plugin, {}, state) })
  return true
}
