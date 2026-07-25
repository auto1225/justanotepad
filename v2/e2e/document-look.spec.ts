import { test, expect } from '@playwright/test'

/**
 * 문서다운 겉모습 회귀 — 제목 계층·인용·코드 블록, 그리고 콜아웃 딱지가 저장/복원마다 늘어나지 않는지.
 * (Tailwind preflight 이 h1~h6 를 본문 크기로 되돌려 제목이 본문과 똑같아 보였던 문제,
 *  콜아웃 딱지가 저장본을 다시 읽을 때 본문 문단으로 쌓이던 문제)
 */
test.describe('문서 겉모습', () => {
  test('제목은 본문보다 크고, 인용·코드 블록은 눈에 띈다', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()

    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<h1>제목1</h1><h2>제목2</h2><h3>제목3</h3><p>본문 문단</p><blockquote><p>인용문</p></blockquote><pre><code>code()</code></pre>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(400)

    const look = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror')!
      const size = (sel: string) => parseFloat(getComputedStyle(pm.querySelector(sel)!).fontSize)
      const pre = pm.querySelector('pre')!
      const bq = pm.querySelector('blockquote')!
      return {
        h1: size('h1'), h2: size('h2'), h3: size('h3'), p: size('p'),
        h1Weight: getComputedStyle(pm.querySelector('h1')!).fontWeight,
        preFont: getComputedStyle(pre).fontFamily,
        preBg: getComputedStyle(pre).backgroundColor,
        bqBorder: parseFloat(getComputedStyle(bq).borderLeftWidth),
      }
    })

    expect(look.h1).toBeGreaterThan(look.p * 1.5)
    expect(look.h2).toBeGreaterThan(look.h3)
    expect(look.h3).toBeGreaterThan(look.p)
    expect(Number(look.h1Weight)).toBeGreaterThanOrEqual(600)
    expect(look.preFont.toLowerCase()).toMatch(/consolas|mono/)
    expect(look.preBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(look.bqBorder).toBeGreaterThan(1)
  })

  test('콜아웃 딱지는 저장했다 다시 열어도 하나뿐이다', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()

    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<div data-callout data-kind="info"><p>알림 내용</p></div>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await expect(page.locator('.ProseMirror [data-callout]')).toHaveCount(1)

    // 자동 저장 → 다시 읽기를 여러 번 거쳐도 딱지가 쌓이면 안 된다
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(1800)
      await page.reload()
      await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })
      await page.waitForTimeout(600)
    }

    const state = await page.evaluate(() => {
      const co = document.querySelector('.ProseMirror [data-callout]')
      if (!co) return null
      return {
        labels: co.querySelectorAll('[data-callout-label]').length,
        paras: co.querySelectorAll('p').length,
        infoParas: [...co.querySelectorAll('p')].filter((p) => /INFO/i.test(p.textContent || '')).length,
      }
    })
    expect(state).not.toBeNull()
    expect(state!.labels).toBe(1)
    expect(state!.infoParas).toBe(0)
    expect(state!.paras).toBe(1)
  })

  test('마크다운 미리보기와 공유 보기도 같은 문서 서식으로 보인다', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<h1>제목1</h1><h2>제목2</h2><p>본문 <a href="https://example.com">링크</a></p><table><tbody><tr><th><p>머리</p></th></tr><tr><td><p>칸</p></td></tr></tbody></table>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(500)

    const openCommand = async (q: string) => {
      await page.keyboard.press('Control+Shift+P')
      await page.locator('.jan-cp-item').first().waitFor()
      await page.keyboard.type(q)
      await page.waitForTimeout(250)
      await page.locator('.jan-cp-item').first().click()
      await page.waitForTimeout(900)
    }

    await openCommand('Markdown 미리보기')
    const md = await page.evaluate(() => {
      const box = document.querySelector('.jan-mdpreview-html')!
      const size = (s: string) => parseFloat(getComputedStyle(box.querySelector(s)!).fontSize)
      const a = box.querySelector('a[href]') as HTMLElement
      const th = box.querySelector('th') as HTMLElement
      return { h1: size('h1'), h2: size('h2'), p: size('p'), link: getComputedStyle(a).textDecorationLine, thBg: getComputedStyle(th).backgroundColor }
    })
    expect(md.h1).toBeGreaterThan(md.p * 1.5)
    expect(md.h2).toBeGreaterThan(md.p)
    expect(md.link).toContain('underline')
    expect(md.thBg).not.toBe('rgba(0, 0, 0, 0)')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // 공유 링크를 만들어 읽기 전용 보기로 연다
    await openCommand('공유 링크')
    await page.waitForTimeout(900)
    const url = await page.evaluate(() => (document.querySelector('.jan-share-url') as HTMLTextAreaElement | HTMLInputElement | null)?.value || '')
    expect(url).toContain('#share=')
    const shared = await page.context().newPage()
    await shared.goto(url)
    await shared.locator('.jan-share-content').waitFor({ timeout: 10000 })
    const sv = await shared.evaluate(() => {
      const box = document.querySelector('.jan-share-content')!
      const size = (s: string) => parseFloat(getComputedStyle(box.querySelector(s)!).fontSize)
      const a = box.querySelector('a[href]') as HTMLElement
      return { h1: size('h1'), p: size('p'), link: getComputedStyle(a).textDecorationLine }
    })
    expect(sv.h1).toBeGreaterThan(sv.p * 1.5)
    expect(sv.link).toContain('underline')
    await shared.close()
  })

  test('내보낸 HTML 파일은 단독으로 열어도 서식이 남는다', async ({ page }, testInfo) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<h1>제목1</h1><p>본문 <a href="https://example.com">링크</a></p><table><tbody><tr><th><p>머리</p></th></tr><tr><td><p>칸</p></td></tr></tbody></table><blockquote><p>인용</p></blockquote>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(500)

    const waitDownload = page.waitForEvent('download', { timeout: 20000 })
    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-item').first().waitFor()
    await page.keyboard.type('HTML')
    await page.waitForTimeout(250)
    await page.locator('.jan-cp-item').first().click()
    const file = await waitDownload
    const saved = testInfo.outputPath('export.html')
    await file.saveAs(saved)

    const opened = await page.context().newPage()
    await opened.goto('file:///' + saved.split('\\').join('/'))
    const look = await opened.evaluate(() => {
      const size = (s: string) => parseFloat(getComputedStyle(document.querySelector(s)!).fontSize)
      const a = document.querySelector('a[href]') as HTMLElement
      const th = document.querySelector('th') as HTMLElement
      const bq = document.querySelector('blockquote') as HTMLElement
      return { h1: size('h1'), p: size('p'), link: getComputedStyle(a).textDecorationLine, thBg: getComputedStyle(th).backgroundColor, bq: parseFloat(getComputedStyle(bq).borderLeftWidth) }
    })
    expect(look.h1).toBeGreaterThan(look.p * 1.5)
    expect(look.link).toContain('underline')
    expect(look.thBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(look.bq).toBeGreaterThan(1)
    await opened.close()
  })
})
