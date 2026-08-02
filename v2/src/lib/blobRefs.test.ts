import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

/**
 * 그림 알맹이를 담는 저장소가 죽어도 그림을 잃지 않아야 한다.
 *
 * 실제로 벌어진 일이다. 저장소(jan-v2-content-blobs)가 판 1인 채 선반 없이 만들어져 있었다.
 * 선반은 onupgradeneeded 안에서만 지을 수 있고 그 자리는 판 번호가 오를 때만 불리므로,
 * 판 1로 여는 한 다시는 불리지 않는다 — 선반을 짓는 코드가 있어도 영영 닿지 못한다.
 * 그래서 읽기도 쓰기도 NotFoundError 로 끝나고, 끌어다 놓은 그림은 아무 말 없이 안 들어가고,
 * 문서에 이미 적혀 있던 jan-blob:// 주소는 아무것도 가리키지 않는 죽은 주소가 되었다.
 *
 * 한 대만의 일이 아니었다 — 손대지 않은 다른 컴퓨터도 같은 꼴이었다.
 */

const DATA = `data:image/png;base64,${'A'.repeat(4096)}`

async function freshModule() {
  vi.resetModules()
  return import('./blobRefs')
}

/** 선반 없는 판 1짜리 저장소를 만들어 둔다 — 판 번호를 안 주고 한 번만 열어도 이렇게 된다 */
function wedgeStore(): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('jan-v2-content-blobs')
    r.onsuccess = () => { r.result.close(); resolve() }
    r.onerror = () => reject(r.error)
  })
}

function storeNames(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('jan-v2-content-blobs')
    r.onsuccess = () => { const n = [...r.result.objectStoreNames]; r.result.close(); resolve(n) }
    r.onerror = () => reject(r.error)
  })
}

describe('그림 저장소', () => {
  beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('선반이 없는 저장소를 만나면 스스로 지어 낸다', async () => {
    await wedgeStore()
    expect(await storeNames()).toEqual([]) // 지금은 텅 비었다

    const { saveDataUrlAsBlobRef, readBlobRef } = await freshModule()
    const ref = await saveDataUrlAsBlobRef(DATA)

    /* 죽은 주소가 아니라 진짜 주소를 받았고, 그 주소로 알맹이가 되읽힌다 */
    expect(ref.startsWith('jan-blob://')).toBe(true)
    expect(await readBlobRef(ref)).toBe(DATA)
    expect(await storeNames()).toContain('blobs')
  })

  it('한 번 지어 놓은 저장소를 다음 실행에서 되부수지 않는다', async () => {
    /* 판 번호를 못박아 열면 이 자리에서 죽는다 — 선반이 없어 판 2로 올려 지어 놓고는,
       다음에 판 1로 열려다 VersionError 를 만난다. 고친 것이 스스로를 되부수는 꼴이다. */
    await wedgeStore()
    const first = await freshModule()
    const ref = await first.saveDataUrlAsBlobRef(DATA)
    expect(ref.startsWith('jan-blob://')).toBe(true)

    /* 껐다 켠 셈 치고 처음부터 다시 — 저장소는 이제 판 2다 */
    const again = await freshModule()
    expect(await again.readBlobRef(ref)).toBe(DATA)
    const ref2 = await again.saveDataUrlAsBlobRef(`${DATA}xyz`)
    expect(ref2.startsWith('jan-blob://')).toBe(true)
  })

  it('저장소가 아예 말을 듣지 않아도 그림을 버리지 않는다', async () => {
    /* 담지 못했는데 주소를 돌려주면 그 주소는 아무것도 가리키지 않는다.
       문서가 무거워지는 편이 그림을 잃는 것보다 낫다. */
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = {}
        setTimeout(() => (req.onerror as (() => void) | undefined)?.(), 0)
        return req
      },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { saveDataUrlAsBlobRef } = await freshModule()

    const out = await saveDataUrlAsBlobRef(DATA)
    expect(out).toBe(DATA) // 자료 그대로 — 죽은 주소가 아니다
  })

  it('저장소가 죽어 있으면 문서 속 그림을 주소로 바꾸지 않는다', async () => {
    /* 바꿔 놓고 담기지 않으면 저장하는 그 순간 그림이 사라진다 */
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = {}
        setTimeout(() => (req.onerror as (() => void) | undefined)?.(), 0)
        return req
      },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { externalizeLargeDataUrlsInHtml } = await freshModule()

    const html = `<p>글</p><img src="${DATA}">`
    const out = await externalizeLargeDataUrlsInHtml(html, 1024)
    expect(out).toContain(DATA)
    expect(out).not.toContain('jan-blob://')
  })

  it('저장소가 멀쩡하면 큰 그림은 주소로 바뀌고 다시 알맹이로 풀린다', async () => {
    const { externalizeLargeDataUrlsInHtml, resolveBlobRefsInHtml } = await freshModule()
    const html = `<p>글</p><img src="${DATA}">`

    const packed = await externalizeLargeDataUrlsInHtml(html, 1024)
    expect(packed).toContain('jan-blob://')
    expect(packed).not.toContain(DATA)
    expect(packed.length).toBeLessThan(html.length)

    expect(await resolveBlobRefsInHtml(packed)).toBe(html)
  })

  it('이미 물려 있는 그림에는 다시 손대지 않는다', async () => {
    /* 같은 값을 넣어도 브라우저는 「고쳐졌다」 고 알린다. 그 알림을 듣고 있던
       watchBlobRefs 가 깨어나 또 넣으면 50ms 마다 끝없이 돈다 — 그때마다 조판이
       다시 돌아 쪽 수가 뒤집히고 그림이 자리를 잡지 못했다. 사용자 화면에서
       그림이 끝내 안 보이던 진짜 까닭이다. */
    const { saveDataUrlAsBlobRef, resolveBlobRefsInElement } = await freshModule()
    const ref = await saveDataUrlAsBlobRef(DATA)

    const root = document.createElement('div')
    root.innerHTML = `<img data-blob-ref="${ref}" src="data:image/gif;base64,R0lGOD">`
    document.body.appendChild(root)

    const writes: string[] = []
    const mo = new MutationObserver((rs) => {
      for (const r of rs) if (r.attributeName === 'src') writes.push('src')
    })
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['src'] })

    await resolveBlobRefsInElement(root)
    await resolveBlobRefsInElement(root)
    await resolveBlobRefsInElement(root)
    await new Promise((r) => setTimeout(r, 0))
    mo.disconnect()
    root.remove()

    /* 처음 한 번만 쓴다 — 뒤의 두 번은 이미 물려 있으므로 손대지 않는다 */
    expect(writes.length).toBe(1)
  })

  it('작은 그림은 건드리지 않는다 — 주소로 바꿔 봐야 손해다', async () => {
    const { externalizeLargeDataUrlsInHtml } = await freshModule()
    const small = 'data:image/png;base64,AAAA'
    const html = `<img src="${small}">`
    expect(await externalizeLargeDataUrlsInHtml(html)).toBe(html)
  })
})
