import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Superscript } from '../extensions/Superscript'
import { Subscript } from '../extensions/Subscript'
import { countFootnoteRefs, insertFootnote, renumberFootnotes } from './footnotes'

function makeEditor(content = '<p>첫 문단</p><p>둘째 문단</p>') {
  return new Editor({ extensions: [StarterKit, Superscript, Subscript], content })
}

/** 각주 표식만 순서대로 뽑아 본다 — 참조인지 본문인지 함께 */
function marks(editor: Editor): string[] {
  const out: string[] = []
  editor.view.dom.querySelectorAll('sup.paper-fn-ref').forEach((el) => {
    out.push((el.classList.contains('paper-fn-body') ? '본문' : '참조') + el.textContent)
  })
  return out
}

describe('각주 번호', () => {
  it('두 번째 각주는 [2] 다 — 본문 줄까지 세어 [3] 이 되지 않는다', () => {
    const editor = makeEditor()
    editor.commands.focus('end')
    insertFootnote(editor)
    editor.commands.setTextSelection(3)
    insertFootnote(editor)
    expect(countFootnoteRefs(editor)).toBe(2)
    expect(marks(editor)).toEqual(['참조[2]', '참조[1]', '본문[1]', '본문[2]'])
    editor.destroy()
  })

  it('번호를 다시 매길 때 참조와 각주 줄을 각각 1부터 센다', () => {
    const editor = makeEditor(
      '<p>가<sup class="paper-fn-ref">[7]</sup>나<sup class="paper-fn-ref">[9]</sup></p>' +
      '<p><sup class="paper-fn-ref paper-fn-body">[7]</sup> 첫 각주</p>' +
      '<p><sup class="paper-fn-ref paper-fn-body">[9]</sup> 둘째 각주</p>'
    )
    renumberFootnotes(editor)
    expect(marks(editor)).toEqual(['참조[1]', '참조[2]', '본문[1]', '본문[2]'])
    editor.destroy()
  })

  it('표시가 없는 옛 문서도 문단 맨 앞 번호를 각주 줄로 알아본다', () => {
    const editor = makeEditor(
      '<p>가<sup class="paper-fn-ref">[5]</sup></p>' +
      '<p><sup class="paper-fn-ref">[5]</sup> 각주 내용</p>'
    )
    renumberFootnotes(editor)
    expect(editor.view.dom.querySelectorAll('sup.paper-fn-ref')[0].textContent).toBe('[1]')
    expect(editor.view.dom.querySelectorAll('sup.paper-fn-ref')[1].textContent).toBe('[1]')
    editor.destroy()
  })

  it('각주가 없으면 아무것도 건드리지 않는다', () => {
    const editor = makeEditor('<p>본문만 있다</p>')
    expect(renumberFootnotes(editor)).toBe(0)
    expect(countFootnoteRefs(editor)).toBe(0)
    editor.destroy()
  })
})
