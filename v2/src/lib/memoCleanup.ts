/**
 * 메모 영구 삭제 시 부속 데이터 정리.
 * 태그·워크스페이스 매핑·버전 히스토리·첨부파일을 함께 지우지 않으면
 * 유령 태그(클릭해도 아무 일 없음)와 IndexedDB 용량 누수가 무한히 쌓인다.
 */
import { useTagsStore } from '../store/tagsStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useVersionsStore } from '../store/versionsStore'
import { listAttachments, deleteAttachment } from './attachments'

export function purgeMemoArtifacts(memoIds: string[]): void {
  if (!memoIds.length) return

  const tags = useTagsStore.getState()
  const nextTags = { ...tags.byMemo }
  let tagsChanged = false
  for (const id of memoIds) {
    if (id in nextTags) {
      delete nextTags[id]
      tagsChanged = true
    }
  }
  if (tagsChanged) useTagsStore.setState({ byMemo: nextTags })

  const ws = useWorkspaceStore.getState()
  const nextWs = { ...ws.byMemo }
  let wsChanged = false
  for (const id of memoIds) {
    if (id in nextWs) {
      delete nextWs[id]
      wsChanged = true
    }
  }
  if (wsChanged) useWorkspaceStore.setState({ byMemo: nextWs })

  const versions = useVersionsStore.getState()
  for (const id of memoIds) versions.removeAll(id)

  // 첨부는 비동기 — 실패해도 앱 동작에는 지장 없으니 조용히 진행
  void (async () => {
    for (const memoId of memoIds) {
      try {
        const items = await listAttachments(memoId)
        for (const item of items) await deleteAttachment(item.id)
      } catch {
        // IndexedDB 접근 실패 시 다음 기회에 정리
      }
    }
  })()
}
