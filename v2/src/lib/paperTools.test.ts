import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { lintPaper } from './paperTools'

/**
 * 논문 검사기는 편집기의 DOM 과 본문 텍스트만 본다 —
 * 그 둘만 흉내 내면 실제 문서 없이도 규칙을 검증할 수 있다.
 */
function fakeEditor(html: string, text?: string): Editor {
  const dom = document.createElement('div')
  dom.className = 'ProseMirror'
  dom.innerHTML = html
  const plain = text ?? (dom.textContent || '')
  return {
    view: { dom },
    state: { doc: { content: { size: plain.length }, textBetween: () => plain } },
  } as unknown as Editor
}

const find = (items: ReturnType<typeof lintPaper>, needle: string) => items.find((i) => i.text.includes(needle))

describe('lintPaper — 초록 인식', () => {
  it('IEEE 처럼 제목과 본문이 한 문단에 붙어 있어도 초록을 찾는다', () => {
    const body = '도심 주차난은 주차면 부족보다 점유 정보의 부재에서 비롯된다. '.repeat(8)
    const items = lintPaper(fakeEditor('<h1>제목</h1>', `제목\nAbstract—${body}\nIndex Terms—parking`))
    expect(find(items, 'Abstract 를 찾지 못했습니다')).toBeUndefined()
    expect(find(items, 'Abstract')?.level).toBe('ok')
  })

  it('한글 초록은 단어가 아니라 글자 수로 센다', () => {
    const body = '위성 관측과 지상 센서를 융합해 점유 상태를 추정한다. '.repeat(10)
    const items = lintPaper(fakeEditor('<h1>제목</h1>', `제목\nAbstract—${body}\nIndex Terms—parking`))
    expect(find(items, 'Abstract')?.text).toMatch(/\d+자$/)
  })

  it('영문 초록은 단어 수로 세고, 너무 길면 주의를 준다', () => {
    const body = 'word '.repeat(320)
    const items = lintPaper(fakeEditor('<h1>Title</h1>', `Title\nAbstract—${body}\nIndex Terms—parking`))
    expect(find(items, 'Abstract')).toMatchObject({ level: 'warn' })
    expect(find(items, 'Abstract')?.text).toMatch(/단어/)
  })

  it('초록이 아예 없으면 못 찾았다고 알린다', () => {
    const items = lintPaper(fakeEditor('<h1>제목</h1>', '제목\n서론 내용'))
    expect(find(items, 'Abstract 를 찾지 못했습니다')).toBeDefined()
  })
})

describe('lintPaper — 캡션 없는 이미지', () => {
  const CAP = '<p data-paper-block="figcap"><span data-paper-tag="figlabel" data-key="f1" data-n="1"></span> 설명</p>'

  it('블록으로 놓인 그림도 바로 뒤 캡션을 인정한다', () => {
    const items = lintPaper(fakeEditor(`<img src="a.png">${CAP}`))
    expect(find(items, '이미지')).toMatchObject({ level: 'ok' })
  })

  it('문단 안에 든 그림도 그 문단 뒤 캡션을 인정한다', () => {
    const items = lintPaper(fakeEditor(`<p><img src="a.png"></p>${CAP}`))
    expect(find(items, '이미지')).toMatchObject({ level: 'ok' })
  })

  it('ProseMirror 가 넣는 빈 separator 이미지는 세지 않는다', () => {
    const sep = '<p data-paper-block="eq"><img class="ProseMirror-separator" alt=""></p>'
    const items = lintPaper(fakeEditor(`<img src="a.png">${CAP}${sep}${sep}`))
    expect(find(items, '이미지')).toMatchObject({ level: 'ok', text: '이미지 1개 모두 캡션 있음' })
  })

  it('캡션이 없는 그림은 여전히 잡아낸다', () => {
    const items = lintPaper(fakeEditor('<img src="a.png"><p>본문</p>'))
    expect(find(items, '캡션 없는 이미지')).toMatchObject({ level: 'warn' })
  })
})
