import type { OpenFileResult } from './fileOps'
import { readAnyDocumentFile } from './fileOps'

/**
 * 바탕화면에서 문서를 두 번 눌러 열기 (PWA file handling).
 *
 * 앱을 한 번 설치해 두면 운영체제가 .jan 을 이 앱에 이어 준다.
 * 그때 브라우저는 주소로 오는 대신 launchQueue 로 파일 손잡이를 건네준다 —
 * 우리는 그것을 평소의 「열기」와 똑같이 처리하면 된다.
 */

interface LaunchParams { files?: FileSystemFileHandle[] }
interface LaunchQueue { setConsumer: (fn: (params: LaunchParams) => void) => void }

export function hasLaunchQueue(): boolean {
  return typeof window !== 'undefined' && 'launchQueue' in window
}

/**
 * 두 번 눌러 연 문서를 받아 넘긴다. 앱이 뜰 때 한 번만 붙인다.
 * @returns 붙였으면 true (이 환경에 launchQueue 가 없으면 false)
 */
export function onLaunchWithFile(open: (doc: OpenFileResult) => void): boolean {
  if (!hasLaunchQueue()) return false
  const queue = (window as unknown as { launchQueue: LaunchQueue }).launchQueue
  queue.setConsumer(async (params) => {
    const handles = params.files ?? []
    for (const handle of handles) {
      try {
        const file = await handle.getFile()
        open(await readAnyDocumentFile(file, handle))
      } catch (err) {
        console.warn('[launchFiles] 두 번 눌러 연 파일을 읽지 못했다:', err)
      }
    }
  })
  return true
}
