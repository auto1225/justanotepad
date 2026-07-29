import { expect, test } from '@playwright/test'

/**
 * 바탕화면에서 .jan 을 두 번 눌러 열기 —
 * 앱을 설치하면 운영체제가 이 앱에 파일을 이어 주고, 아이콘도 우리 것이 붙는다.
 * 그 약속(manifest)이 실제로 서비스되고 있는지 지킨다.
 */
test.describe('문서 형식 연결 (PWA file handler)', () => {
  test('manifest 가 .jan 을 우리 앱 문서로 등록한다', async ({ page }) => {
    const res = await page.request.get('./manifest.webmanifest')
    expect(res.ok()).toBeTruthy()
    const manifest = await res.json()

    const handler = (manifest.file_handlers ?? [])[0]
    expect(handler, 'file_handlers 가 있어야 두 번 눌러 열기가 된다').toBeTruthy()
    expect(handler.accept['application/x-justanotepad+zip']).toContain('.jan')
    expect(handler.action).toBe('/v2/')
    // 파일 아이콘이 있어야 탐색기에서 정체불명 문서로 보이지 않는다
    expect(handler.icons?.length).toBeGreaterThan(0)
    expect(manifest.launch_handler?.client_mode).toBe('navigate-existing')
  })

  test('앱·문서 아이콘이 실제로 서비스된다', async ({ page }) => {
    for (const path of ['icons/app-192.png', 'icons/app-512.png', 'icons/jan-file-256.png', 'icons/jan-file-64.png']) {
      const res = await page.request.get(`./${path}`)
      expect(res.ok(), `${path} 가 없다`).toBeTruthy()
      expect(res.headers()['content-type']).toContain('image/png')
      expect((await res.body()).length).toBeGreaterThan(300)
    }
  })

  test('두 번 눌러 연 파일을 받을 준비가 되어 있다 (launchQueue 소비자)', async ({ page }) => {
    // launchQueue 를 흉내 내 두고 앱을 띄우면, 앱이 소비자를 붙여야 한다
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      // 크로미움이 이미 갖고 있는 값이라 그냥 대입하면 먹지 않는다 — 속성을 갈아 끼운다
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: { setConsumer: (fn: unknown) => { (window as unknown as { __consumer?: unknown }).__consumer = fn } },
      })
    })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __consumer?: unknown }).__consumer)).toBe('function')

    // 그 소비자에게 .jan 손잡이를 건네면 문서가 열려야 한다
    await page.evaluate(async () => {
      const mod = await import('/v2/src/lib/janFormat.ts')
      const blob = await mod.packJan({ title: '두 번 눌러 연 문서', html: '<p>바탕화면에서 열었다</p>', pageSettings: {} })
      const file = new File([blob], '두 번 눌러 연 문서.jan', { type: mod.JAN_MIME })
      const consumer = (window as unknown as { __consumer: (p: unknown) => void }).__consumer
      consumer({ files: [{ getFile: async () => file }] })
    })
    await expect(page.locator('.ProseMirror')).toContainText('바탕화면에서 열었다', { timeout: 10000 })
  })
})
