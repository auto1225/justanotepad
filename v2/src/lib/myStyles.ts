import type { Editor } from '@tiptap/react'
import { flash } from './flash'

/**
 * 내 스타일 (스타일 세트) — 현재 선택 텍스트의 서식(마크 조합 + 정렬)을
 * 이름 붙여 저장하고 원클릭으로 재적용한다. Word 스타일 갤러리의 간이판.
 */
export interface MyStyle {
  name: string
  marks: Array<{ type: string; attrs: Record<string, unknown> }>
  textAlign?: string
}

const KEY = 'jan-v2-my-styles'

export function loadMyStyles(): MyStyle[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function save(list: MyStyle[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))) } catch { /* 무시 */ }
}

/** 현재 선택의 서식을 이름으로 저장. 성공 시 true */
export function saveCurrentAsStyle(editor: Editor, name: string): boolean {
  const sel = editor.state.selection
  if (sel.empty) { flash('먼저 저장할 서식이 적용된 텍스트를 선택하세요'); return false }
  const marks = editor.state.doc.resolve(sel.from).marks()
  const textAlign = editor.getAttributes('paragraph').textAlign || editor.getAttributes('heading').textAlign
  const style: MyStyle = {
    name: name.trim().slice(0, 24),
    marks: marks.map((m) => ({ type: m.type.name, attrs: m.attrs as Record<string, unknown> })),
    textAlign,
  }
  if (!style.name) return false
  const list = loadMyStyles().filter((s) => s.name !== style.name)
  list.unshift(style)
  save(list)
  flash(`내 스타일 "${style.name}" 저장됨 (마크 ${style.marks.length}개)`)
  return true
}

/** 선택 영역에 저장된 스타일 적용 */
export function applyMyStyle(editor: Editor, style: MyStyle): void {
  const sel = editor.state.selection
  if (sel.empty) { flash('먼저 스타일을 적용할 텍스트를 선택하세요'); return }
  const chain = editor.chain().focus().setTextSelection({ from: sel.from, to: sel.to })
  chain.unsetAllMarks()
  for (const mark of style.marks) {
    try { (chain as unknown as { setMark: (t: string, a: Record<string, unknown>) => typeof chain }).setMark(mark.type, mark.attrs) } catch { /* 스키마에 없는 마크 무시 */ }
  }
  if (style.textAlign) chain.setTextAlign(style.textAlign)
  chain.run()
  flash(`"${style.name}" 스타일 적용됨`)
}

export function deleteMyStyle(name: string): void {
  save(loadMyStyles().filter((s) => s.name !== name))
}

/** 스타일 목록 오버레이 — 클릭 적용, 삭제 버튼 포함 */
export function showMyStylesPicker(editor: Editor): void {
  document.getElementById('jan-mystyles-picker')?.remove()
  const list = loadMyStyles()
  const wrap = document.createElement('div')
  wrap.id = 'jan-mystyles-picker'
  wrap.className = 'jan-modal-overlay'
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const marksLabel = (s: MyStyle) => s.marks.map((m) => m.type).join(', ') || '기본'
  wrap.innerHTML =
    '<div class="jan-modal jan-mystyles-modal" role="dialog" aria-label="내 스타일">' +
    '<div class="jan-modal-head"><h3>내 스타일</h3><button class="jan-modal-close" aria-label="닫기">닫기</button></div>' +
    '<div class="jan-modal-body jan-mystyles-body">' +
    (list.length === 0
      ? '<p class="jan-mystyles-empty">저장된 스타일이 없습니다.<br/>서식이 적용된 텍스트를 선택하고 "현재 서식을 내 스타일로 저장"을 실행하세요.</p>'
      : list.map((s) => `
        <div class="jan-mystyles-item" data-name="${esc(s.name)}">
          <button type="button" class="jan-mystyles-apply" data-name="${esc(s.name)}">
            <strong>${esc(s.name)}</strong>
            <small>${esc(marksLabel(s))}${s.textAlign ? ' · ' + esc(s.textAlign) : ''}</small>
          </button>
          <button type="button" class="jan-mystyles-del" data-name="${esc(s.name)}" aria-label="삭제">삭제</button>
        </div>`).join('')) +
    '</div></div>'
  const close = () => wrap.remove()
  wrap.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    if (t === wrap) { close(); return }
    if (t.closest('.jan-modal-close')) { close(); return }
    const applyBtn = t.closest('.jan-mystyles-apply') as HTMLElement | null
    if (applyBtn) {
      const st = loadMyStyles().find((s) => s.name === applyBtn.dataset.name)
      if (st) applyMyStyle(editor, st)
      close()
      return
    }
    const delBtn = t.closest('.jan-mystyles-del') as HTMLElement | null
    if (delBtn) {
      deleteMyStyle(delBtn.dataset.name || '')
      close()
      showMyStylesPicker(editor)
    }
  })
  document.body.appendChild(wrap)
}
