import { afterEach, describe, expect, it, vi } from 'vitest'
import { openFile, readPageSettings, saveToFile, wrapHtml } from './fileOps'

/** 테스트에서 File System Access API 를 갈아끼우기 위한 창 타입 */
const fsaTestWindow = () => window as unknown as { showOpenFilePicker?: unknown }


describe('fileOps', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete fsaTestWindow().showOpenFilePicker
    document.body.innerHTML = ''
  })

  it('opens HTML through an input fallback when File System Access is unavailable', async () => {
    delete fsaTestWindow().showOpenFilePicker
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      const file = new File(['<!doctype html><html><body><h1>Fallback Open</h1><p>Loaded.</p></body></html>'], 'fallback.html', { type: 'text/html' })
      Object.defineProperty(this, 'files', { configurable: true, value: [file] })
      this.dispatchEvent(new Event('change'))
    })

    const result = await openFile()

    expect(click).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      title: 'fallback',
      content: '<h1>Fallback Open</h1><p>Loaded.</p>',
      handle: null,
    })
  })

  it('falls back to input when File System Access open fails for a non-cancel error', async () => {
    ;fsaTestWindow().showOpenFilePicker = vi.fn(async () => {
      throw new Error('blocked')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      const file = new File(['<body><p>Recovered</p></body>'], 'recovered.htm', { type: 'text/html' })
      Object.defineProperty(this, 'files', { configurable: true, value: [file] })
      this.dispatchEvent(new Event('change'))
    })

    const result = await openFile()

    expect(result?.title).toBe('recovered')
    expect(result?.content).toBe('<p>Recovered</p>')
    expect(result?.handle).toBeNull()
  })

  it('does not show the fallback picker when File System Access is canceled', async () => {
    ;fsaTestWindow().showOpenFilePicker = vi.fn(async () => {
      throw new DOMException('Canceled', 'AbortError')
    })
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    await expect(openFile()).resolves.toBeNull()
    expect(click).not.toHaveBeenCalled()
  })
})

/**
 * 저장한 파일은 제 판형을 스스로 지니고 다닌다 —
 * 그래야 다른 문서(2단 논문 등)를 보던 중에 열어도 그 설정이 묻어나지 않는다.
 */
describe('파일에 담기는 쪽 설정', () => {
  const settings = {
    paperStyle: 'blank',
    pageSize: 'A4',
    pageColumnCount: 1,
    runningHeader: '보고서 "머리글" & 부제',
    pageMarginsMm: { top: 22, right: 20, bottom: 20, left: 20 },
  }

  it('저장한 파일에서 쪽 설정을 그대로 되읽는다', () => {
    expect(readPageSettings(wrapHtml('보고서', '<p>본문</p>', settings))).toEqual(settings)
  })

  it('따옴표·꺾쇠가 든 머리글도 깨지지 않는다', () => {
    const html = wrapHtml('제목', '<p>본문</p>', { runningHeader: '<b>"제목"</b> & 부제' })
    expect(readPageSettings(html)).toEqual({ runningHeader: '<b>"제목"</b> & 부제' })
  })

  it('쪽 설정이 없는 보통 HTML 은 undefined 를 준다 (기본 판형으로 연다)', () => {
    expect(readPageSettings('<!doctype html><html><body><p>남이 만든 문서</p></body></html>')).toBeUndefined()
    expect(readPageSettings(wrapHtml('제목', '<p>본문</p>'))).toBeUndefined()
  })
})

/** 저장은 한 번만 물어본다 — 자리를 고른 뒤 쓰기가 어긋나도 창을 또 띄우지 않는다 */
describe('파일 저장', () => {
  const fsaSaveWindow = () => window as unknown as { showSaveFilePicker?: unknown }

  afterEach(() => {
    vi.restoreAllMocks()
    delete fsaSaveWindow().showSaveFilePicker
  })

  it('쓰기가 실패해도 내려받기 창을 다시 띄우지 않고 실패를 알린다', async () => {
    const picker = vi.fn(async () => ({
      createWritable: async () => { throw new Error('디스크가 가득 찼다') },
    }))
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>' })

    expect(picker).toHaveBeenCalledTimes(1)
    expect(click).not.toHaveBeenCalled() // 0KB 파일 + 두 번째 저장창이 생기던 자리
    expect(result.ok).toBe(false)
    expect(result.error).toContain('디스크')
  })

  it('자리를 고르는 단계가 막히면 그때만 내려받기로 대신한다', async () => {
    fsaSaveWindow().showSaveFilePicker = vi.fn(async () => { throw new Error('보안 정책으로 막힘') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>' })

    expect(click).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('저장한 내용에 쪽 설정이 함께 적힌다', async () => {
    let written = ''
    fsaSaveWindow().showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({
        write: (text: string) => { written = text },
        close: async () => {},
      }),
    }))

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', pageSettings: { pageColumnCount: 2 } })

    expect(result.ok).toBe(true)
    expect(readPageSettings(written)).toEqual({ pageColumnCount: 2 })
  })
})
