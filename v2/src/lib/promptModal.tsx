import { createRoot, type Root } from 'react-dom/client'
import { ConfirmModal, PromptModal, type AskOptions } from '../components/AskModals'

/**
 * 앱 스타일 입력 모달 — window.prompt 대체.
 * Promise 로 값(또는 취소 시 null)을 반환해 기존 prompt 호출부를 최소 변경으로 교체.
 *
 *   const url = await askText('이미지 URL:')
 *   if (url) ...
 *
 * 모달 화면은 components/AskModals 에 있다 (컴포넌트/함수를 한 파일에 섞으면 빠른 새로고침이 깨진다).
 */

let container: HTMLDivElement | null = null
let root: Root | null = null

function ensureRoot(): Root {
  if (!container) {
    container = document.createElement('div')
    container.id = 'jan-prompt-modal-root'
    document.body.appendChild(container)
    root = createRoot(container)
  }
  return root!
}

export function askText(title: string, defaultValue = '', opts: Partial<AskOptions> = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const r = ensureRoot()
    const close = (value: string | null) => {
      r.render(null)
      resolve(value)
    }
    r.render(<PromptModal title={title} defaultValue={defaultValue} {...opts} onClose={close} />)
  })
}

/** 앱 스타일 확인 모달 — window.confirm 대체. 확인 시 true, 취소/닫기 시 false */
export function askConfirm(title: string, detail = '', okLabel = '확인'): Promise<boolean> {
  return new Promise((resolve) => {
    const r = ensureRoot()
    const close = (ok: boolean) => {
      r.render(null)
      resolve(ok)
    }
    r.render(<ConfirmModal title={title} detail={detail} okLabel={okLabel} onClose={close} />)
  })
}
