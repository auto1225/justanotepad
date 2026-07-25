import { useEffect, useState } from 'react'
import { HelpTipLayer } from './components/HelpTipLayer'
import { Editor } from './components/Editor'
import { Sidebar } from './components/Sidebar'
import { useMemosStore } from './store/memosStore'
import { useI18nStore } from './lib/i18n'
import { useUIStore } from './store/uiStore'

function App() {
  const lang = useI18nStore((s) => s.lang)
  const { focusMode, toggleFocus, zoom, zoomIn, zoomOut, zoomReset, headingNumbers, readingMode, toggleReading, spellCheck, sidebarCollapsed } = useUIStore()
  const [memosHydrated, setMemosHydrated] = useState(() => useMemosStore.persist.hasHydrated())

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    try {
      document.body.classList.toggle('jan-show-pilcrow', localStorage.getItem('jan-show-pilcrow') === '1')
    } catch {
      document.body.classList.remove('jan-show-pilcrow')
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('jan-focus-mode', focusMode)
    document.body.classList.toggle('jan-heading-numbers', headingNumbers)
    document.body.classList.toggle('jan-reading-mode', readingMode)
    // 읽기 모드에서는 편집 잠금 (CSS 만으로는 타이핑이 막히지 않는다)
    document.querySelectorAll('.ProseMirror').forEach((el) => el.setAttribute('contenteditable', readingMode ? 'false' : 'true'))
    document.body.classList.toggle('jan-sidebar-hidden', sidebarCollapsed)
    document.documentElement.style.setProperty('--jan-zoom', String(zoom))
    document.querySelectorAll('.ProseMirror').forEach((el) => el.setAttribute('spellcheck', spellCheck ? 'true' : 'false'))
  }, [focusMode, zoom, headingNumbers, readingMode, spellCheck, sidebarCollapsed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return
      // Shift+F11 은 읽기 모드 — shift 를 제외하지 않으면 집중 모드가 먼저 걸려 상쇄됐다
      if (e.key === 'F11' && e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleReading() }
      else if (e.key === 'F11' && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggleFocus() }
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn() }
      else if (ctrl && !e.shiftKey && e.key === '-') { e.preventDefault(); zoomOut() }
      else if (ctrl && !e.shiftKey && e.key === '0') { e.preventDefault(); zoomReset() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [toggleFocus, zoomIn, zoomOut, zoomReset, toggleReading])

  const { currentId, newMemo, list } = useMemosStore()

  useEffect(() => {
    if (memosHydrated) return
    if (useMemosStore.persist.hasHydrated()) {
      const timer = window.setTimeout(() => setMemosHydrated(true), 0)
      return () => window.clearTimeout(timer)
    }
    return useMemosStore.persist.onFinishHydration(() => setMemosHydrated(true))
  }, [memosHydrated])

  useEffect(() => {
    if (!memosHydrated) return
    if (!currentId && list().length === 0) newMemo()
    else if (!currentId && list().length > 0) {
      const first = list()[0]
      if (first) useMemosStore.getState().setCurrent(first.id)
    }
  }, [currentId, list, memosHydrated, newMemo])

  if (!memosHydrated) {
    return (
      <div className="jan-app">
        <div className="jan-boot">로컬 노트를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="jan-app">
      <a href="#jan-editor" className="skip-to-content">본문으로 건너뛰기</a>
      <Editor sidebar={!focusMode && <Sidebar />} />
      <HelpTipLayer />
    </div>
  )
}

export default App
