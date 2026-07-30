import type { Editor } from '@tiptap/react'
import { PAGE_BREAK_HTML } from './pageBreak'

export function installWordKeymap(editor: Editor, opts: {
  onNew?: () => void
  onSave?: () => void
  onOpen?: () => void
  onPrint?: () => void
}) {
  const handler = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return

    // 다른 입력 필드(모달 검색창, 설정 input 등)에 포커스가 있으면 개입하지 않는다 —
    // 전역 캡처 리스너라 이 가드가 없으면 팔레트/설정에서 Ctrl+L·R 등이 편집기로 포커스를 뺏어간다
    const target = e.target as HTMLElement | null
    const inForeignField = !!target && (
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' ||
      (target.isContentEditable && !editor.view.dom.contains(target))
    )
    if (inForeignField) return

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey
    const k = e.key.toLowerCase()

    // 파일 조작은 앱 어디서나 (편집기 밖 포커스여도) 동작
    if (ctrl && !shift && !alt && k === 'n') { e.preventDefault(); opts.onNew?.(); return }
    if (ctrl && !shift && !alt && k === 's') { e.preventDefault(); opts.onSave?.(); return }
    if (ctrl && !shift && !alt && k === 'o') { e.preventDefault(); opts.onOpen?.(); return }
    if (ctrl && !shift && !alt && k === 'p') { e.preventDefault(); opts.onPrint?.(); return }

    /* 검수(워드 「검토」) 계열 — 수식어는 하나만 쓴다.
       F7·Shift+F7 은 워드 자리, F9 는 한글의 한자 바꾸기 자리다. */
    if (!ctrl && !shift && !alt && k === 'f7') { e.preventDefault(); window.dispatchEvent(new Event('jan-spell-toggle')); return }
    if (!ctrl && shift && !alt && k === 'f7') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('jan-word-suggest', { detail: { mode: 'synonym' } }))
      return
    }
    if (!ctrl && !shift && !alt && k === 'f9') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('jan-word-suggest', { detail: { mode: 'hanja' } }))
      return
    }
    if (alt && !ctrl && !shift && k === 'f11') { e.preventDefault(); window.dispatchEvent(new Event('jan-review-pane')); return }
    if (alt && !ctrl && !shift && k === 'u') { e.preventDefault(); window.dispatchEvent(new Event('jan-track-toggle')); return }
    if (alt && !ctrl && !shift && (k === ',' || k === '.')) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('jan-track-goto', { detail: { dir: k === '.' ? 1 : -1 } }))
      return
    }

    /* 문서 자동 작성 — 수식어 하나로. 문서에 초점이 없어도 열려야 하므로 초점 검사보다 앞에 둔다.
       Alt 자리는 그림·표 개체가 거의 다 쓰고 있어 (Alt+W 는 감싸기, Alt+K 는 그림 자리)
       남은 j 를 「짓기」 로 삼았다. AI 연결은 한 번 하는 일이라 자리표를 두지 않고
       리본 AI 탭과 명령 팔레트로 연다 (둘 다 키보드로 끝까지 갈 수 있다). */
    if (alt && !ctrl && !shift && k === 'j') { e.preventDefault(); window.dispatchEvent(new CustomEvent('jan-ai-write', { detail: {} })); return }

    // 서식/편집 계열은 편집기에 포커스가 있을 때만 — 아니면 Ctrl+R(새로고침)·Ctrl+L(주소창) 같은
    // 브라우저 기본 동작을 돌려준다
    if (!editor.isFocused) return

    if (ctrl && !shift && !alt && k === 'k') {
      e.preventDefault()
      // prompt 대신 툴바의 링크 편집 팝오버를 연다 (Toolbar 가 이 이벤트를 수신)
      window.dispatchEvent(new CustomEvent('jan-open-link-editor'))
      return
    }
    if (ctrl && !shift && !alt && k === 'l') { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); return }
    if (ctrl && !shift && !alt && k === 'e') { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); return }
    if (ctrl && !shift && !alt && k === 'r') { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); return }
    if (ctrl && !shift && !alt && k === 'j') { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); return }
    if (ctrl && !shift && !alt && k === 'm') { e.preventDefault(); indentListItem(editor, 'in'); return }
    if (ctrl && shift && !alt && k === 'm') { e.preventDefault(); indentListItem(editor, 'out'); return }
    if (ctrl && shift && !alt && k === 'l') { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); return }
    // Word 의 Ctrl+Space 는 글자 서식만 지운다 — clearNodes 까지 하면 제목/목록 구조가 날아감
    if (ctrl && !shift && !alt && k === ' ') { e.preventDefault(); editor.chain().focus().unsetAllMarks().run(); return }
    if (!ctrl && !alt && k === 'tab' && shouldHandleListTab(editor)) {
      const moved = indentListItem(editor, shift ? 'out' : 'in')
      if (moved) e.preventDefault()
      return
    }
    if (!ctrl && shift && !alt && k === 'f3') { e.preventDefault(); toggleSelectionCase(editor); return }
    if (ctrl && alt && !shift && (k === '1' || k === '2' || k === '3')) {
      e.preventDefault()
      const level = parseInt(k, 10) as 1 | 2 | 3
      const chain = editor.chain().focus()
      /* 빈 문서에서 전체 선택(Ctrl+A) 상태면 제목이 걸리지 않는다 — 고를 글자가 없어
         서식 범위가 잡히지 않기 때문. 커서 위치로 좁혀서 적용한다(리본 버튼과 같은 결과). */
      if (!editor.state.doc.textContent) chain.setTextSelection(editor.state.selection.from)
      chain.toggleHeading({ level }).run()
      return
    }
    if (ctrl && !shift && !alt && k === 'enter') {
      e.preventDefault()
      e.stopImmediatePropagation()
      editor.chain().focus().insertContent(PAGE_BREAK_HTML).run()
      return
    }
    if (ctrl && alt && !shift && k === 'f') {
      e.preventDefault()
      insertFootnote(editor)
      return
    }
  }

  document.addEventListener('keydown', handler, true)
  return () => document.removeEventListener('keydown', handler, true)
}

type ListIndentDirection = 'in' | 'out'
type ListItemType = 'listItem' | 'taskItem'

function shouldHandleListTab(editor: Editor) {
  return editor.view.hasFocus() && !editor.isActive('table') && Boolean(getActiveListItemType((name) => editor.isActive(name)))
}

export function getActiveListItemType(isActive: (name: string) => boolean): ListItemType | null {
  if (isActive('taskItem')) return 'taskItem'
  if (isActive('listItem')) return 'listItem'
  return null
}

function indentListItem(editor: Editor, direction: ListIndentDirection) {
  const itemType = getActiveListItemType((name) => editor.isActive(name))
  if (!itemType) return false
  const chain = editor.chain().focus()
  return direction === 'in'
    ? chain.sinkListItem(itemType).run()
    : chain.liftListItem(itemType).run()
}


function toggleSelectionCase(editor: Editor) {
  const { from, to, empty } = editor.state.selection
  if (empty) return
  const text = editor.state.doc.textBetween(from, to)
  if (!text) return
  const next = nextCase(text)
  editor.chain().focus().insertContentAt({ from, to }, next).setTextSelection({ from, to: from + next.length }).run()
}

function nextCase(text: string): string {
  const hasLetters = /[A-Za-z가-힣]/.test(text)
  if (!hasLetters) return text
  if (text === text.toUpperCase() && text !== text.toLowerCase()) return text.toLowerCase()
  if (text === text.toLowerCase() && text !== text.toUpperCase()) {
    return text.replace(/\b([A-Za-z])([A-Za-z]*)/g, (_, first: string, rest: string) => first.toUpperCase() + rest.toLowerCase())
  }
  return text.toUpperCase()
}

function insertFootnote(editor: Editor) {
  const count = document.querySelectorAll('.paper-fn-ref').length + 1
  editor.chain().focus().insertContent(`<sup class="paper-fn-ref">[${count}]</sup>`).run()
}

