import { useEffect } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { Step } from '@tiptap/pm/transform'

/**
 * 여러 에디터 인스턴스가 하나의 문서를 공유하도록 트랜잭션 스텝을 브로드캐스트한다.
 * (창 나누기·쪽 나란히 편집이 공유하는 동기화 엔진)
 *
 * 규칙:
 * - 어느 에디터에서 문서가 바뀌면 나머지 전부에 같은 스텝을 적용한다
 *   (모든 dispatch 가 같은 JS 틱에서 동기 실행되므로 문서가 어긋날 틈이 없다)
 * - 스텝은 수신 스키마로 재구성한다. 인스턴스마다 스키마 객체가 달라 그대로 적용하면
 *   콘텐츠 검증이 실패한다 (협업 프로토콜과 같은 JSON 왕복 방식)
 * - 실행취소는 첫 에디터(main)의 히스토리로 일원화한다:
 *   다른 창 → main 릴레이만 히스토리에 쌓고, main → 다른 창은 addToHistory:false
 * - 릴레이로 들어온 트랜잭션은 다시 브로드캐스트하지 않는다 (무한 루프 차단)
 */
const RELAY_META = 'jan-doc-relay'

// 인스턴스마다 안정적인 번호 — 배열 항등성이 매 렌더 달라져도 구성 변화만 감지하기 위해
const instanceIds = new WeakMap<TiptapEditor, number>()
let nextInstanceId = 1
function idOf(editor: TiptapEditor): number {
  let id = instanceIds.get(editor)
  if (!id) { id = nextInstanceId++; instanceIds.set(editor, id) }
  return id
}

export function useDocRelay(editors: Array<TiptapEditor | null>, enabled = true) {
  // 실제 인스턴스 구성이 바뀔 때만 재구성한다
  const key = editors.map((e) => (e ? idOf(e) : 0)).join('|')

  useEffect(() => {
    const list = editors.filter((e): e is TiptapEditor => !!e)
    if (!enabled || list.length < 2) return
    const main = list[0]

    // setContent 재동기화가 다시 핸들러에 잡히면 동기 무한 재귀가 된다 — 가드 필수
    let resyncing = false
    const resync = (from: TiptapEditor, to: TiptapEditor) => {
      if (resyncing || to.isDestroyed) return
      resyncing = true
      try {
        to.commands.setContent(from.getJSON(), { emitUpdate: false })
      } finally {
        window.setTimeout(() => { resyncing = false }, 0)
      }
    }

    // 참여 직후 1회 전체 정렬 — 인스턴스 생성 시점 이후 main 이 변했을 수 있다
    for (const ed of list.slice(1)) resync(main, ed)

    const handlers: Array<[TiptapEditor, (p: { transaction: unknown }) => void]> = []
    for (const source of list) {
      const onTransaction = ({ transaction }: { transaction: unknown }) => {
        const tr = transaction as { docChanged: boolean; getMeta: (k: string) => unknown; steps: Step[] }
        if (resyncing || !tr.docChanged || tr.getMeta(RELAY_META)) return
        for (const target of list) {
          if (target === source || target.isDestroyed) continue
          const next = target.state.tr
          try {
            for (const step of tr.steps) next.step(Step.fromJSON(target.state.schema, step.toJSON()))
          } catch (e) {
            console.warn('[문서 동기화] 스텝 적용 실패 — 재동기화:', e instanceof Error ? e.message : e)
            resync(source, target)
            continue
          }
          next.setMeta(RELAY_META, true)
          // main 의 히스토리에만 쌓아 Ctrl+Z 를 한 곳으로 모은다
          if (!(target === main && source !== main)) next.setMeta('addToHistory', false)
          target.view.dispatch(next)
        }
      }
      source.on('transaction', onTransaction)
      handlers.push([source, onTransaction])
    }

    return () => {
      for (const [ed, fn] of handlers) ed.off('transaction', fn)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
}
