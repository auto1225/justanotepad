import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
import { computeDocHealth } from './docHealth'

vi.mock('../extensions/PageDocument', () => ({ getSavableHtml: (e: { view: { dom: HTMLElement } }) => e.view.dom.innerHTML }))

function fakeEditor(html: string, text = '본문입니다.'): Editor {
  const dom = document.createElement('div')
  dom.className = 'ProseMirror'
  dom.innerHTML = html
  return {
    view: { dom },
    state: { doc: { content: { size: text.length }, textBetween: () => text } },
  } as unknown as Editor
}

const media = (html: string) => computeDocHealth(fakeEditor(html)).areas.find((a) => a.key === 'media')!

describe('computeDocHealth — 미디어', () => {
  const CAP = '<p data-paper-block="figcap">Fig. 1. 설명</p>'

  it('ProseMirror 의 빈 separator 이미지는 이미지로 세지 않는다', () => {
    const sep = '<p data-paper-block="eq"><img class="ProseMirror-separator" alt=""></p>'
    const area = media(`<img src="a.png" alt="구성도">${CAP}${sep}${sep}${sep}`)
    expect(area.details.some((d) => d.text.includes('설명 없는 이미지'))).toBe(false)
    expect(area.details.some((d) => d.text === '이미지 1개 모두 설명 있음')).toBe(true)
  })

  it('블록으로 놓인 그림도 바로 뒤 캡션을 설명으로 인정한다', () => {
    const area = media(`<img src="a.png">${CAP}`)
    expect(area.details.some((d) => d.text.includes('설명 없는 이미지'))).toBe(false)
  })

  it('설명도 캡션도 없는 그림은 여전히 감점한다', () => {
    const area = media('<img src="a.png"><p>본문</p>')
    expect(area.details.some((d) => d.level === 'warn' && d.text.includes('설명 없는 이미지 1/1개'))).toBe(true)
    expect(area.score).toBeLessThan(20)
  })
})
