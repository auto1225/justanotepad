import { describe, expect, it } from 'vitest'
import { JAN_MIME, isJanName, packJan, unpackJan } from './janFormat'

/** 1×1 투명 PNG */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('우리 문서 형식 (.jan)', () => {
  const doc = {
    title: '우주주차 보고서',
    html: `<h1>제목</h1><p>본문</p><img src="${PNG}" alt="로고">`,
    pageSettings: { pageColumnCount: 2, paperStyle: 'blank', runningHeader: '머리글' },
  }

  it('싸고 풀면 본문·제목·쪽 설정이 그대로 돌아온다', async () => {
    const packed = await packJan(doc)
    const back = await unpackJan(await packed.arrayBuffer())

    expect(back.title).toBe(doc.title)
    expect(back.html).toContain('<h1>제목</h1>')
    expect(back.html).toContain('<p>본문</p>')
    expect(back.pageSettings).toEqual(doc.pageSettings)
  })

  it('그림은 본문에서 떼어 media 로 담고, 열 때 다시 물려 준다', async () => {
    const packed = await packJan(doc)
    const raw = new TextDecoder().decode(new Uint8Array(await packed.arrayBuffer()))
    expect(raw).toContain('media/m1.png') // 묶음 안에 그림 파일로 들어갔다

    const back = await unpackJan(await packed.arrayBuffer())
    expect(back.html).toContain(PNG) // 열면 다시 그림이 붙어 있다
    expect(back.html).not.toContain('media/m1.png')
  })

  it('묶음 첫머리에 형식 표시(mimetype)가 있다', async () => {
    const packed = await packJan(doc)
    const raw = new TextDecoder().decode(new Uint8Array(await packed.arrayBuffer()))
    expect(raw).toContain(JAN_MIME)
  })

  it('그림이 많아도 본문에는 짧은 이름만 남는다 (파일이 부풀지 않게)', async () => {
    const many = { ...doc, html: `<p>${`<img src="${PNG}">`.repeat(5)}</p>` }
    const packed = await packJan(many)
    const back = await unpackJan(await packed.arrayBuffer())
    expect((back.html.match(/data:image\/png/g) || []).length).toBe(5)
  })

  it('이름으로 우리 형식을 가린다', () => {
    expect(isJanName('보고서.jan')).toBe(true)
    expect(isJanName('보고서.JAN')).toBe(true)
    expect(isJanName('보고서.html')).toBe(false)
  })

  it('본문이 없는 묶음은 분명한 잘못으로 알린다', async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    zip.file('jan.json', '{}')
    await expect(unpackJan(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow('본문')
  })
})
