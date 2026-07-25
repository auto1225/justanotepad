import { test, expect } from '@playwright/test'

/**
 * Phase 8 — JustANotepad v2 smoke E2E.
 * 라이브 https://justanotepad.com/v2/ 또는 로컬 dev 서버.
 */

test.describe('v2 smoke', () => {
  test('app loads and renders editor', async ({ page }) => {
    await page.goto('./')
    // 툴바 + ProseMirror 가 보이는지
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('tab', { name: '파일', exact: true })).toBeVisible()
  })

  test('typing in editor saves to memo', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible' })
    await editor.click()
    await page.keyboard.type('Hello E2E ' + Date.now())
    // 입력이 화면에 보이는지
    await expect(editor).toContainText('Hello E2E')
  })

  test('opens AI helper modal with Ctrl+/', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('Control+/')
    await expect(page.locator('.jan-ai-modal')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('opens search panel with Ctrl+Shift+F', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('Control+Shift+F')
    await expect(page.locator('.jan-search-modal')).toBeVisible()
  })

  test('keyboard help opens with F1', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('F1')
    await expect(page.locator('.jan-help-modal')).toBeVisible()
  })

  test('MS Word shortcuts keep Ctrl+K for links and Ctrl+Shift+P for commands', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.type('OpenAI')
    await page.keyboard.press('Control+A')

    await page.keyboard.press('Control+K')
    const linkPop = page.locator('.jan-link-popover')
    await expect(linkPop).toBeVisible()
    await linkPop.getByLabel('링크 URL').fill('https://openai.com')
    await linkPop.getByRole('button', { name: '적용' }).click()
    await expect(editor.locator('a[href="https://openai.com"]')).toContainText('OpenAI')

    await page.keyboard.press('Control+Shift+P')
    await expect(page.locator('.jan-cp')).toBeVisible()
  })

  test('list indentation follows Word-style Tab and Shift+Tab behavior', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('- ')
    await page.keyboard.type('Parent')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Child')
    await expect(editor.locator('ul > li', { hasText: 'Child' })).toHaveCount(1)

    await page.keyboard.press('Tab')
    await expect(editor.locator('ul ul li', { hasText: 'Child' })).toHaveCount(1)

    await page.keyboard.press('Shift+Tab')
    await expect(editor.locator('ul ul li', { hasText: 'Child' })).toHaveCount(0)
  })

  test('toolbar buttons present', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    for (const label of ['파일', '편집', '보기', '입력', '서식', '쪽', 'AI', '도구', '논문']) {
      await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible({ timeout: 5000 })
    }
    await page.getByRole('tab', { name: '파일', exact: true }).click()
    await expect(page.locator('.jan-ribbon-body').getByRole('button', { name: '저장', exact: true })).toBeVisible()
    await expect(page.locator('.jan-ribbon-body').getByRole('button', { name: /HWPX/ })).toBeVisible()
    await expect(page.locator('.jan-ribbon-body').getByRole('button', { name: /Markdown/ }).first()).toBeVisible()
    await page.getByRole('tab', { name: '쪽', exact: true }).click()
    await expect(page.locator('.jan-ribbon-body').getByRole('button', { name: /페이지 크기 설정/ })).toBeVisible()
    await expect(page.locator('.jan-ribbon-body').getByRole('button', { name: /노트 배경 스타일/ })).toBeVisible()
    await page.locator('.jan-ribbon-body').getByRole('button', { name: /페이지 크기 설정/ }).click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
  })

  test('file menu and Ctrl+N create real memos', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 15000 })
    const tabs = page.locator('.jan-memo-tab')
    await expect(tabs).toHaveCount(1)

    await editor.click()
    await page.keyboard.type('Memo before new file action')
    await page.getByRole('tab', { name: '파일', exact: true }).click()
    await page.getByRole('button', { name: '새 메모', exact: true }).first().click()
    await expect(tabs).toHaveCount(2)
    await expect(editor).not.toContainText('Memo before new file action')

    await page.keyboard.press('Control+N')
    await expect(tabs).toHaveCount(3)
  })

  test('file menu open uses the HTML input fallback without File System Access', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      ;(window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = undefined
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 15000 })

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('tab', { name: '파일', exact: true }).click()
    await page.getByRole('button', { name: '열기...', exact: true }).click()
    const chooser = await chooserPromise
    await chooser.setFiles({
      name: 'opened-fallback.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><html><body><h1>Opened from fallback</h1><p>Works on mobile-style browsers.</p></body></html>'),
    })

    await expect(editor).toContainText('Opened from fallback')
    await expect(page.locator('.jan-header-title-input')).toHaveValue('opened-fallback')
    await expect(page.locator('.jan-memo-tab.is-active')).toContainText('opened-fallback')
  })

  test('v1 note paper default and page settings are available', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-paper', 'lined')
    await expect(pages).toHaveAttribute('data-page-size', 'A4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'portrait')
    await expect(pages).toHaveAttribute('data-page-columns', '1')
    await expect(page.locator('.jan-page-running-footer')).toHaveCount(0)
    const ruler = page.getByRole('img', { name: /가로 눈금자/ })
    const verticalRuler = page.locator('.jan-ruler-v').first()
    await expect(ruler).toBeVisible()
    await expect(verticalRuler).toBeVisible()
    // 여백은 눈금자의 회색 구간으로 보인다 — 20mm 는 96dpi 기준 약 75.6px
    const padWidths = await ruler.locator('.jan-ruler-pad').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width))
    )
    expect(padWidths).toHaveLength(2)
    padWidths.forEach((w) => expect(Math.abs(w - 76)).toBeLessThanOrEqual(2))
    // 들여쓰기 손잡이(첫 줄·왼쪽·오른쪽)
    await expect(ruler.locator('.jan-ruler-grip')).toHaveCount(3)
    const pageStatus = page.getByRole('button', { name: '상태바 페이지 설정' })
    await expect(pageStatus).toContainText('인쇄')
    await expect(pageStatus).toContainText('A4')
    await expect(pageStatus).toContainText('세로')
    await expect(pageStatus).toContainText('여백 20mm')

    await pageStatus.click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
    await page.locator('.jan-page-settings-modal').getByLabel('닫기').click()

    // 노트 줄 무늬는 노트 화면(초안 보기·기존 모델)에만 그린다 —
    // 인쇄 보기의 독립 페이지 모델에서 이 요소는 용지가 아니라 '책상'이라
    // 여기에 무늬를 그리면 용지 밖에 줄이 그어진다.
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')
      raw.state = { ...(raw.state || {}), pageModel: 'legacy' }
      localStorage.setItem('jan-v2-ui', JSON.stringify(raw))
    })
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    const backgroundImage = await page
      .locator('.ProseMirror')
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundImage)
    expect(backgroundImage).toContain('repeating-linear-gradient')
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')
      raw.state = { ...(raw.state || {}), pageModel: 'nodes' }
      localStorage.setItem('jan-v2-ui', JSON.stringify(raw))
    })
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await page.getByRole('button', { name: '페이지 설정 열기' }).click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'A3' })).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'B4' })).toBeVisible()
    await expect(page.locator('.jan-paper-style-card', { hasText: '줄노트' })).toBeVisible()

    await page.locator('.jan-page-size-card', { hasText: 'B4' }).click()
    await page.getByRole('button', { name: '가로' }).click()
    await page.getByRole('button', { name: '2단' }).click()
    await page.locator('.jan-paper-style-card', { hasText: '모눈종이' }).click()
    await page.getByLabel('위 여백 mm').fill('12')
    await page.getByLabel('오른쪽 여백 mm').fill('16')
    await page.getByLabel('아래 여백 mm').fill('20')
    await page.getByLabel('왼쪽 여백 mm').fill('24')
    await page.getByLabel('페이지 머리글').fill('프로젝트 헤더')
    await page.getByLabel('페이지 꼬리말').fill('Page {page}')
    await page.locator('.jan-page-settings-modal').getByRole('button', { name: '적용' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')
    await expect(page.getByLabel('편집 화면 머리글 미리보기')).toHaveText('프로젝트 헤더')
    await expect(page.getByLabel('편집 화면 꼬리말 미리보기')).toHaveText('Page 1')
    await expect(page.locator('.jan-page-margin-frame')).toBeVisible()
    await expect(pageStatus).toContainText('B4')
    await expect(pageStatus).toContainText('가로')
    await expect(pageStatus).toContainText('2단')
    await expect(pageStatus).toContainText('상12 우16 하20 좌24mm')
    // 바뀐 여백은 눈금자의 회색 구간 폭으로 나타난다 (좌 24mm≈91px, 우 16mm≈60px)
    const changedPads = await ruler.locator('.jan-ruler-pad').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width))
    )
    expect(Math.abs(changedPads[0] - 91)).toBeLessThanOrEqual(3)
    expect(Math.abs(changedPads[1] - 60)).toBeLessThanOrEqual(3)
    const vPads = await page
      .locator('.jan-ruler-v')
      .first()
      .locator('.jan-ruler-pad')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)))
    expect(Math.abs(vPads[0] - 45)).toBeLessThanOrEqual(3)
    expect(Math.abs(vPads[1] - 76)).toBeLessThanOrEqual(3)
    const columnCount = await editor.evaluate((node) => getComputedStyle(node).columnCount)
    expect(columnCount).toBe('2')
    const padding = await editor.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        top: Math.round(parseFloat(style.paddingTop)),
        right: Math.round(parseFloat(style.paddingRight)),
        bottom: Math.round(parseFloat(style.paddingBottom)),
        left: Math.round(parseFloat(style.paddingLeft)),
      }
    })
    expect(padding).toEqual({ top: 45, right: 60, bottom: 76, left: 91 })
    const pageUi = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state)
    expect(pageUi.runningHeader).toBe('프로젝트 헤더')
    expect(pageUi.runningFooter).toBe('Page {page}')
    expect(pageUi.pageColumnCount).toBe(2)
    expect(pageUi.pageMarginsMm).toEqual({ top: 12, right: 16, bottom: 20, left: 24 })

    await page.getByRole('textbox', { name: '메모 제목' }).fill('B4 layout memo')
    await page.reload()
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')

    await page.getByRole('tab', { name: '쪽', exact: true }).click()
    await page.locator('.jan-ribbon-body .jan-ribbon-btn').getByText('미리보기', { exact: true }).first().click()
    await expect(page.locator('.jan-print-title')).toContainText('B4 가로')
    await expect(page.locator('.jan-print-title')).toContainText('2단')
    const printSrcdoc = await page.locator('.jan-print-iframe').evaluate((iframe) => (iframe as HTMLIFrameElement).srcdoc)
    expect(printSrcdoc).toContain('@page { size: 353mm 250mm; margin: 12mm 16mm 20mm 24mm;')
    expect(printSrcdoc).toContain('data-columns="2"')
    expect(printSrcdoc).toContain('프로젝트 헤더')
    await page.locator('.jan-print-shell').getByRole('button', { name: /닫기/ }).click()

    await page.getByRole('button', { name: '+ 새 메모' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'lined')
    await expect(pages).toHaveAttribute('data-page-size', 'A4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'portrait')
    await expect(pages).toHaveAttribute('data-page-columns', '1')

    await page.getByRole('listitem').filter({ hasText: 'B4 layout memo' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')
  })

  test('status bar surfaces personal storage sync failures on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem(
        'jan-v2-settings',
        JSON.stringify({ state: { syncEnabled: true, syncProvider: 'onedrive' }, version: 0 })
      )
      localStorage.setItem('jan.v2.sync.lastError', 'OneDrive token expired')
      localStorage.setItem('jan.v2.sync.lastErrorAt', String(Date.now()))
      localStorage.setItem('jan.v2.sync.lastProvider', 'onedrive')
    })
    await page.goto('./')
    const syncChip = page.locator('.jan-sync-status-chip.is-error')
    await expect(syncChip).toBeVisible({ timeout: 15000 })
    await expect(syncChip).toContainText('OneDrive')

    await syncChip.click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-sync-health-alert')).toContainText('OneDrive token expired')
  })

  test('open settings refreshes personal sync health events without reopening', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem(
        'jan-v2-settings',
        JSON.stringify({ state: { syncEnabled: true, syncProvider: 'dropbox' }, version: 0 })
      )
    })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.keyboard.press('Control+,')
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-sync-health-alert')).toHaveCount(0)

    await page.evaluate(() => {
      localStorage.setItem('jan.v2.sync.lastError', 'Dropbox autosync failed')
      localStorage.setItem('jan.v2.sync.lastErrorAt', String(Date.now()))
      localStorage.setItem('jan.v2.sync.lastProvider', 'dropbox')
      window.dispatchEvent(new Event('jan-byoc-sync-health'))
    })

    await expect(page.locator('.jan-sync-health-alert')).toContainText('Dropbox autosync failed')
  })

  test('business card extraction from the current memo corrects draft fields before save', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(`명함에서 읽은 정보:
이름 최민호
회사 우주주차
전화 064.756.1633
팩스 064.756.1634
이메일 cmh@woojoocha.com
주소 제주특별자치도 제주시 첨단로 245-13`)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('명함')
    await page.locator('.jan-cp-item', { hasText: '명함 관리' }).click()
    const modal = page.locator('.jan-cards-modal')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /명함 추가/ }).click()

    const form = modal.locator('.jan-card-form')
    await form.getByLabel('이름', { exact: true }).fill('오인식')
    await form.getByLabel('전화', { exact: true }).fill('000-0000-0000')
    await modal.getByRole('button', { name: /현재 메모에서 추출/ }).click()

    await expect(form.getByLabel('이름', { exact: true })).toHaveValue('최민호')
    await expect(form.getByLabel('회사', { exact: true })).toHaveValue('우주주차')
    await expect(form.getByLabel('휴대폰', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('전화', { exact: true })).toHaveValue('064.756.1633')
    await expect(form.getByLabel('팩스', { exact: true })).toHaveValue('064.756.1634')
    await expect(form.getByLabel('이메일', { exact: true })).toHaveValue('cmh@woojoocha.com')
    await expect(form.getByLabel('주소', { exact: true })).toHaveValue('제주특별자치도 제주시 첨단로 245-13')
    await expect(modal.locator('.jan-cards-inline-status')).toContainText('초안')

    await form.getByRole('button', { name: /저장/ }).click()
    await expect(modal.locator('.jan-card-profile')).toContainText('최민호')
    await expect(modal.locator('.jan-card-profile')).toContainText('우주주차')
    await expect(modal.locator('.jan-card-profile')).toContainText('064.756.1633')
  })

  test('view zoom controls support Word-style fit modes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    const zoomValue = page.locator('.jan-zoom-value')
    const readZoom = () => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.zoom || 1)

    await expect(zoomValue).toHaveText('100%')
    await page.getByRole('tab', { name: '보기', exact: true }).click()
    await page.locator('.jan-ribbon-body').getByRole('button', { name: '한 페이지 보기', exact: true }).click()
    await expect.poll(readZoom).toBeLessThan(1)
    await expect(zoomValue).not.toHaveText('100%')
    const wholePageZoom = await readZoom()

    await page.getByRole('tab', { name: '보기', exact: true }).click()
    await page.locator('.jan-ribbon-body').getByRole('button', { name: '페이지 너비에 맞춤', exact: true }).click()
    await expect.poll(readZoom).toBeGreaterThan(wholePageZoom)
    const widthZoom = await readZoom()

    await page.getByLabel('상태바 줌 아웃').click()
    await expect.poll(readZoom).toBeLessThan(widthZoom)
    await page.getByLabel('상태바 줌 인').click()
    await expect.poll(readZoom).toBeGreaterThan(widthZoom - 0.01)

    const zoomSlider = page.getByLabel('상태바 줌 슬라이더')
    await zoomSlider.focus()
    await page.keyboard.press('Home')
    await expect.poll(readZoom).toBe(0.35)
    await expect(zoomValue).toHaveText('35%')
  })

  test('view menu can hide and restore page rulers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-rulers', 'true')
    await expect(page.getByRole('img', { name: /가로 눈금자/ })).toBeVisible()
    await expect(page.locator('.jan-ruler-v').first()).toBeVisible()

    await page.getByRole('tab', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '눈금자 숨기기' }).click()
    await expect(pages).toHaveAttribute('data-rulers', 'false')
    await expect(page.getByRole('img', { name: /가로 눈금자/ })).toHaveCount(0)
    await expect(page.locator('.jan-ruler-v')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.showRulers)).toBe(false)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('눈금자 표시')
    await page.locator('.jan-cp-list').getByRole('button', { name: /눈금자 표시/ }).first().click()
    await expect(pages).toHaveAttribute('data-rulers', 'true')
    await expect(page.getByRole('img', { name: /가로 눈금자/ })).toBeVisible()
    await expect(page.locator('.jan-ruler-v').first()).toBeVisible()
  })

  test('view menu switches between print and draft layouts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    const pageStatus = page.getByRole('button', { name: '상태바 페이지 설정' })
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-view-layout', 'print')
    await expect(pageStatus).toContainText('인쇄')

    await page.getByRole('tab', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '초안 레이아웃', exact: true }).click()
    await expect(pages).toHaveAttribute('data-view-layout', 'draft')
    await expect(pages).toHaveAttribute('data-rulers', 'false')
    await expect(page.getByRole('img', { name: /가로 눈금자/ })).toHaveCount(0)
    await expect(pageStatus).toContainText('초안')
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.viewLayout)).toBe('draft')

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('인쇄 레이아웃')
    await page.getByRole('button', { name: /인쇄 레이아웃/ }).first().click()
    await expect(pages).toHaveAttribute('data-view-layout', 'print')
    await expect(pageStatus).toContainText('인쇄')
    await expect(page.getByRole('img', { name: /가로 눈금자/ })).toBeVisible()
  })

  test('page breaks use one canonical Word-style marker', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    const breaks = editor.locator('hr.jan-page-break[data-page-break="1"]')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('First page')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.type('Second page')
    await expect(breaks).toHaveCount(1)
    await expect(editor).toContainText('Second page')

    await page.getByRole('tab', { name: '쪽', exact: true }).click()
    await page.locator('.jan-ribbon-body').getByRole('button', { name: /페이지 구분 삽입/ }).click()
    await expect(breaks).toHaveCount(2)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('페이지 구분')
    await page.getByRole('button', { name: /페이지 구분/ }).first().click()
    await expect(breaks).toHaveCount(3)
  })

  test('meeting notes flow inserts a structured v1-style note', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    // 회의 노트는 헤더 정리 후 더보기(⋯) 메뉴로 옮겼다
    await page.locator('.jan-header-more-btn').click()
    await page.locator('.jan-header-more-menu').getByRole('menuitem', { name: '회의 노트' }).click()
    await expect(page.locator('.jan-meeting-modal')).toBeVisible()
    await page.locator('.jan-meeting-capture input').first().fill('동기화 점검 회의')
    await page.locator('.jan-meeting-capture textarea').nth(1).fill('오늘 회의에서는 v2 동기화 정책을 확정했습니다.\n민수 담당으로 다음 주까지 Dropbox 백업 테스트를 진행해야 합니다.')
    await page.getByRole('button', { name: '발언 추가' }).click()
    await expect(page.locator('.jan-meeting-transcript-list article')).toHaveCount(2)
    await expect(page.locator('.jan-meeting-result')).toContainText('액션 아이템')

    await page.getByRole('button', { name: '메모에 삽입' }).click()
    await expect(page.locator('.ProseMirror').first()).toContainText('동기화 점검 회의')
    await expect(page.locator('.ProseMirror').first()).toContainText('Dropbox 백업 테스트')
  })

  test('find and replace uses Word-style document positions and whole-word matching', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Heading')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Needle catalog cat cat2 cat')

    await page.keyboard.press('Control+H')
    const findbar = page.locator('.jan-findbar')
    await expect(findbar).toBeVisible()
    const findInput = findbar.locator('input[type="text"]').nth(0)
    const replaceInput = findbar.locator('input[type="text"]').nth(1)
    const count = findbar.locator('.jan-findbar-count')

    await findInput.fill('Needle')
    await expect(count).toHaveText('1/1')
    await replaceInput.fill('Found')
    await findbar.getByRole('button', { name: '바꾸기' }).click()
    await expect(editor).toContainText('Heading')
    await expect(editor).toContainText('Found catalog cat cat2 cat')

    await findInput.fill('cat')
    await replaceInput.fill('dog')
    await findbar.locator('label', { hasText: '단어' }).locator('input').check()
    await expect(count).toHaveText('1/2')
    await findbar.getByRole('button', { name: '전체' }).click()
    await expect(editor).toContainText('Found catalog dog cat2 dog')
  })

  test('outline panel behaves like a Word navigation pane', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+Alt+1')
    await page.keyboard.type('Project Plan')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Alt+2')
    await page.keyboard.type('Scope')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Shift+N')
    await page.keyboard.type('Body text')

    await page.getByRole('tab', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: /목차/ }).click()
    const outline = page.locator('.jan-outline')
    await expect(outline).toBeVisible()
    await expect(outline.locator('.jan-outline-head small')).toHaveText('2')
    await expect(outline.getByRole('button', { name: /Project Plan/ })).toBeVisible()
    await expect(outline.locator('.jan-outline-item.is-active', { hasText: 'Scope' })).toBeVisible()

    await outline.getByLabel('목차 제목 검색').fill('Scope')
    await expect(outline.getByRole('button', { name: /Scope/ })).toBeVisible()
    await expect(outline.getByRole('button', { name: /Project Plan/ })).toHaveCount(0)
  })

  test('table sorting keeps the header row and sorts data rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem('jan-v2-ui', JSON.stringify({ state: { zoom: 1, viewLayout: 'print', showRulers: true }, version: 0 }))
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')

    await page.getByRole('tab', { name: '입력', exact: true }).click()
    await page.getByRole('button', { name: '표 (3×3)' }).click()

    const cells = page.locator('.ProseMirror table th, .ProseMirror table td')
    await expect(cells).toHaveCount(9)
    const values = ['Name', 'Amount', 'Note', 'Beta', '10', 'B row', 'Alpha', '2', 'A row']
    for (let i = 0; i < values.length; i += 1) {
      await page.keyboard.type(values[i])
      if (i < values.length - 1) await page.keyboard.press('Tab')
    }

    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Shift+Tab')
    await page.locator('.jan-table-menu').getByTitle('현재 열 오름차순').click()
    const rows = page.locator('.ProseMirror table tr')
    await expect(rows.nth(0)).toContainText('Name')
    await expect(rows.nth(1)).toContainText('Alpha')
    await expect(rows.nth(2)).toContainText('Beta')
  })

  test('table aggregates skip headers and the result cell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem('jan-v2-ui', JSON.stringify({ state: { zoom: 1, viewLayout: 'print', showRulers: true }, version: 0 }))
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')

    await page.getByRole('tab', { name: '입력', exact: true }).click()
    await page.getByRole('button', { name: '표 (3×3)' }).click()

    const cells = page.locator('.ProseMirror table th, .ProseMirror table td')
    await expect(cells).toHaveCount(9)
    const values = ['Name', 'Amount', 'Note', 'Beta', '₩10', 'B row', 'Alpha', '2', 'A row']
    for (let i = 0; i < values.length; i += 1) {
      await page.keyboard.type(values[i])
      if (i < values.length - 1) await page.keyboard.press('Tab')
    }

    await page.locator('.jan-table-menu').getByTitle('아래 행 추가').click()
    await expect(cells).toHaveCount(12)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.locator('.jan-table-menu').getByTitle('현재 열 합계').click()
    await expect(cells.nth(10)).toContainText('합계: 12')
  })

  test('document style presets apply Word-like typography settings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.getByRole('tab', { name: '서식', exact: true }).click()
    await page.locator('.jan-ribbon-body .jan-ribbon-btn[aria-label="문서 스타일"]').click()
    const modal = page.locator('.jan-typography-modal')
    await expect(modal).toBeVisible()

    await modal.locator('.jan-typography-preset', { hasText: '원고/논문' }).click()
    await expect(modal.locator('.jan-typography-preset.is-active', { hasText: '원고/논문' })).toBeVisible()

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-typography') || '{}')?.state)
    expect(stored).toMatchObject({
      presetId: 'manuscript',
      fontFamily: 'serif',
      fontSize: 15,
      paragraphSpacing: 12,
    })

    const editorStyle = await page.locator('.ProseMirror').first().evaluate((node) => {
      const style = getComputedStyle(node)
      return { fontFamily: style.fontFamily, lineHeight: style.lineHeight, fontSize: style.fontSize }
    })
    expect(editorStyle.fontFamily).toContain('Noto Serif KR')
    expect(editorStyle.fontSize).toBe('15px')
  })

  test('role pack inserts v1-rich templates with fresh document numbers', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem(
        'jan-v2-role-tools',
        JSON.stringify({ state: { selectedRoleIds: ['pm', 'freelancer'], roleData: {} }, version: 1 })
      )
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-open-roles')))

    const modal = page.locator('.jan-roles-modal')
    await expect(modal).toBeVisible()
    await modal.locator('.jan-rolepack-nav').getByRole('button', { name: /템플릿/ }).click()

    const pmSection = modal.locator('.jan-role-template-section').filter({ hasText: '기획자(PM/PO)' })
    await pmSection.locator('.jan-roles-template', { hasText: 'PRD — Product Requirements Document' }).click()
    await expect(editor).toContainText('PRD 리뷰 체크')
    await expect(editor).toContainText('North Star')

    await modal.getByRole('button', { name: /닫기/ }).click()
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-open-roles')))
    await expect(modal).toBeVisible()
    await modal.locator('.jan-rolepack-nav').getByRole('button', { name: /템플릿/ }).click()

    const freelancerSection = modal.locator('.jan-role-template-section').filter({ hasText: '프리랜서' })
    await freelancerSection.locator('.jan-roles-template', { hasText: '청구서' }).click()
    await expect(editor).toContainText('청구서 #INV-')
    await expect(editor).not.toContainText('INV-1777180963006')
    await expect(editor).toContainText(/INV-\d{8}-\d{5}/)
  })

  test('template modal saves the live editor html before debounce persistence', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    const marker = `Live template body ${Date.now()}`
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(marker)

    await page.getByRole('tab', { name: '도구', exact: true }).click()
    await page.getByRole('button', { name: '템플릿', exact: true }).click()
    const modal = page.locator('.jan-templates-modal')
    await expect(modal).toBeVisible()
    await modal.locator('input[placeholder="템플릿 이름"]').fill('Live editor template')
    await modal.locator('input[placeholder="카테고리 (선택)"]').fill('QA')
    await modal.getByRole('button', { name: '저장' }).click()
    await expect(modal.locator('.jan-templates-list')).toContainText('Live editor template')
    await modal.getByRole('button', { name: '새 메모로' }).click()

    await expect(editor).toContainText(marker)
  })

  test('mobile header keeps dense v1 actions accessible from the more menu', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })

    const header = page.locator('.jan-app-header')
    await expect(header).toBeVisible()
    const headerBox = await header.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(Math.ceil((headerBox?.x || 0) + (headerBox?.width || 0))).toBeLessThanOrEqual(360)
    await page.locator('.jan-header-more-btn').click()
    const menu = page.locator('.jan-header-more-menu')
    await expect(menu).toBeVisible()
    await expect(menu.locator('button').first()).toBeVisible()
    expect(await menu.locator('button').count()).toBeGreaterThan(10)

    const menuBox = await menu.boundingBox()
    expect(menuBox).not.toBeNull()
    expect(Math.floor(menuBox?.x || 0)).toBeGreaterThanOrEqual(0)
    expect(Math.ceil((menuBox?.x || 0) + (menuBox?.width || 0))).toBeLessThanOrEqual(360)
    expect(Math.ceil((menuBox?.y || 0) + (menuBox?.height || 0))).toBeLessThanOrEqual(740)

    // 메뉴에서 고른 기능이 실제로 열린다 (첫 항목은 그림판)
    await menu.getByRole('menuitem', { name: '공유' }).click()
    await expect(page.locator('.jan-share-modal')).toBeVisible({ timeout: 15000 })
  })

  test('좁은 화면에서도 리본 탭·명령이 화면 안에 들어온다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 })
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })

    // 탭 줄은 가로로 스크롤되더라도 화면 밖으로 넘치지 않는다
    const tabs = page.locator('.jan-ribbon-tabs')
    await expect(tabs).toBeVisible()
    const tabBox = await tabs.boundingBox()
    expect(Math.floor(tabBox?.x || 0)).toBeGreaterThanOrEqual(0)
    expect(Math.ceil((tabBox?.x || 0) + (tabBox?.width || 0))).toBeLessThanOrEqual(390)

    // 쪽 탭 → 쪽 설정 명령 실행
    await page.getByRole('tab', { name: '쪽', exact: true }).click()
    const cmd = page.locator('.jan-ribbon-body').getByRole('button', { name: /페이지 크기 설정/ }).first()
    await cmd.scrollIntoViewIfNeeded()
    await cmd.click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
  })
})
