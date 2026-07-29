import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { recoverFromStaleChunks, registerV2ServiceWorker } from './lib/swRegister'
import { startMultiTabSync } from './lib/multiTabSync'
import { readShareFragment } from './lib/shareLink'
import { handleByocOAuthRedirectIfNeeded } from './lib/byocSync'
import { startByocAutosync } from './lib/byocAutosync'

async function main() {
  // share fragment가 있으면 읽기 전용 공유 보기로 전환한다.
  const share = await readShareFragment()
  if (share) {
    document.body.classList.add('jan-share-view')
    const root = document.getElementById('root')!
    root.innerHTML = `
      <div class="jan-share-page">
        <header class="jan-share-header">
          <h1>${escape(share.title || '무제')}</h1>
          <div class="jan-share-meta">공유 링크 보기 · ${new Date(share.createdAt).toLocaleString('ko-KR')}</div>
          <a href="/v2/" class="jan-share-edit">JustANotepad에서 새 메모 작성하기</a>
        </header>
        <article class="jan-share-content">${share.content}</article>
      </div>
    `
    return
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )

  registerV2ServiceWorker()
  recoverFromStaleChunks()
  startMultiTabSync()
  startByocAutosync()
  handleByocOAuthRedirectIfNeeded().catch((error: unknown) => {
    try {
      localStorage.setItem('jan.v2.byoc.oauth.error', error instanceof Error ? error.message : String(error))
    } catch {
      return
    }
  })
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

main()
