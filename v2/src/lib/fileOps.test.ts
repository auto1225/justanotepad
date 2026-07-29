import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allowFsaWriteAgain, openFile, readPageSettings, saveToFile, wrapHtml } from './fileOps'

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

  beforeEach(() => allowFsaWriteAgain())
  afterEach(() => {
    vi.restoreAllMocks()
    delete fsaSaveWindow().showSaveFilePicker
    allowFsaWriteAgain()
  })

  it('그냥 「저장」은 파일 창을 띄우지 않고 바로 저장한다', async () => {
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write: () => {}, close: async () => {} }) }))
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>' })

    expect(picker).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('「다른 이름」으로 한 번 성공하면 그 다음 「저장」은 그 자리에 곧바로 쓴다', async () => {
    let written = ''
    const handle = { createWritable: async () => ({ write: (t: string) => { written = t }, close: async () => {} }) }
    const picker = vi.fn(async () => handle)
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const saved = await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true })
    expect(picker).toHaveBeenCalledTimes(1)
    expect(saved.handle).toBeTruthy()
    expect(written).toContain('<p>본문</p>')

    // 손잡이를 잃어버린 뒤(탭을 다시 연 경우)에도, 된다는 것을 아는 환경이면 창을 띄워 이어 간다
    const again = await saveToFile({ title: '보고서', content: '<p>둘째</p>' })
    expect(picker).toHaveBeenCalledTimes(2)
    expect(again.ok).toBe(true)
    expect(click).not.toHaveBeenCalled()
  })

  it('내장된 화면(iframe)에서는 헛되이 파일 창을 띄우지 않고 곧장 내려받는다', async () => {
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write: () => {}, close: async () => {} }) }))
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const top = vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window)

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>' })

    expect(picker).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    top.mockRestore()
  })

  it('그 환경이 파일 쓰기를 막으면, 다음 저장부터는 창을 한 번만 띄운다', async () => {
    const picker = vi.fn(async () => ({
      createWritable: async () => { throw new DOMException('platform', 'NotAllowedError') },
    }))
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    // 「다른 이름」으로 한 번은 창이 뜬다 → 막힘 → 내려받기
    await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true })
    expect(picker).toHaveBeenCalledTimes(1)

    // 그 뒤로는 「다른 이름」이라도 헛된 창을 띄우지 않는다
    const second = await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true })
    expect(picker).toHaveBeenCalledTimes(1)
    expect(second.ok).toBe(true)
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('쓰기가 실패해도 내려받기 창을 다시 띄우지 않고 실패를 알린다', async () => {
    const picker = vi.fn(async () => ({
      createWritable: async () => { throw new Error('디스크가 가득 찼다') },
    }))
    fsaSaveWindow().showSaveFilePicker = picker
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true })

    expect(picker).toHaveBeenCalledTimes(1)
    expect(click).not.toHaveBeenCalled() // 0KB 파일 + 두 번째 저장창이 생기던 자리
    expect(result.ok).toBe(false)
    expect(result.error).toContain('디스크')
  })

  it('자리를 고르는 단계가 막히면 그때만 내려받기로 대신한다', async () => {
    fsaSaveWindow().showSaveFilePicker = vi.fn(async () => { throw new Error('보안 정책으로 막힘') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true })

    expect(click).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('쓰기 허락이 없으면 내려받기로 건네준다 (사람이 누른 저장)', async () => {
    const handle = {
      queryPermission: async () => 'prompt' as PermissionState,
      requestPermission: async () => 'denied' as PermissionState,
      createWritable: async () => { throw new DOMException('nope', 'NotAllowedError') },
    }
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', handle: handle as unknown as FileSystemFileHandle })

    expect(click).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('자동 저장은 허락이 없어도 내려받기로 새지 않는다', async () => {
    const handle = {
      queryPermission: async () => 'prompt' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState, // 조용한 저장에서는 묻지 않아야 한다
      createWritable: async () => { throw new DOMException('nope', 'NotAllowedError') },
    }
    const asked = vi.spyOn(handle, 'requestPermission')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveToFile({
      title: '보고서', content: '<p>본문</p>', silent: true,
      handle: handle as unknown as FileSystemFileHandle,
    })

    expect(asked).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: false, needsPermission: true })
  })

  it('허락이 이미 있으면 묻지 않고 그대로 쓴다', async () => {
    let written = ''
    const handle = {
      queryPermission: async () => 'granted' as PermissionState,
      requestPermission: async () => 'granted' as PermissionState,
      createWritable: async () => ({ write: (t: string) => { written = t }, close: async () => {} }),
    }
    const asked = vi.spyOn(handle, 'requestPermission')

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', handle: handle as unknown as FileSystemFileHandle })

    expect(asked).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(written).toContain('<p>본문</p>')
  })

  it('저장한 내용에 쪽 설정이 함께 적힌다', async () => {
    let written = ''
    fsaSaveWindow().showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({
        write: (text: string) => { written = text },
        close: async () => {},
      }),
    }))

    const result = await saveToFile({ title: '보고서', content: '<p>본문</p>', pick: true, pageSettings: { pageColumnCount: 2 } })

    expect(result.ok).toBe(true)
    expect(readPageSettings(written)).toEqual({ pageColumnCount: 2 })
  })
})
