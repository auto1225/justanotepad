import { test, expect } from '@playwright/test'

/**
 * 서식 도구 상자 — 이 컴퓨터 글꼴 목록, 그리고 크기·줄간격·자간·장평의
 * 직접 입력 / 증감 단추 / 키보드 조작이 선택 영역에 실제로 적용되는지.
 */
test.describe('글자 모양 도구 상자', () => {
  // 자간·장평 칸은 좁은 화면에서 리본으로 물러난다(서식줄을 한 줄로 유지) — 넓은 창에서 확인한다
  test.use({ viewport: { width: 1440, height: 900 } })

  const openDoc = async (page: import('@playwright/test').Page) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.type('가나다라마바사 아자차카타파하')
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await page.waitForTimeout(150)
    return editor
  }

  const setBox = async (page: import('@playwright/test').Page, label: string, text: string) => {
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    const box = page.locator(`input[aria-label="${label}"]`)
    await box.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
  }

  test('글꼴 목록에 이 컴퓨터에 깔린 글꼴이 나오고 검색해서 고를 수 있다', async ({ page }) => {
    await openDoc(page)
    await page.locator('.jan-fontcombo-btn').click()
    await page.locator('.jan-fontcombo-pop').waitFor()

    // 기본 목록 — 권한 없이도 설치된 글꼴을 찾아낸다
    const count = await page.locator('.jan-fontcombo-list .jan-fontcombo-item').count()
    expect(count).toBeGreaterThan(5)

    await page.locator('.jan-fontcombo-search').click()
    await page.keyboard.type('georgia')
    await page.waitForTimeout(250)
    const names = await page.locator('.jan-fontcombo-list .jan-fontcombo-item').allInnerTexts()
    expect(names.join(' ').toLowerCase()).toContain('georgia')

    await page.locator('.jan-fontcombo-list .jan-fontcombo-item').nth(1).click()
    await page.waitForTimeout(350)
    const html = await page.locator('.ProseMirror').first().innerHTML()
    expect(html).toContain('font-family')
  })

  test('크기·자간·장평·줄간격을 직접 입력해 선택 영역에 적용한다', async ({ page }) => {
    const editor = await openDoc(page)

    await setBox(page, '글자 크기', '14')
    await expect(editor).toContainText('가나다라마바사')
    expect(await editor.innerHTML()).toContain('font-size: 14pt')

    await setBox(page, '자간', '15')
    expect(await editor.innerHTML()).toContain('letter-spacing: 0.15em')

    await setBox(page, '장평', '80')
    expect(await editor.innerHTML()).toContain('data-char-scale="80"')

    await setBox(page, '줄 간격', '2.2')
    expect(await editor.innerHTML()).toContain('line-height: 2.2')
  })

  test('증감 단추와 키보드 ↑↓ 로도 값이 오르내린다', async ({ page }) => {
    await openDoc(page)
    await setBox(page, '글자 크기', '12')
    const size = page.locator('input[aria-label="글자 크기"]')

    await page.locator('button[aria-label="글자 크기 늘리기"]').click()
    await page.waitForTimeout(250)
    expect(await size.inputValue()).toBe('13')

    await page.locator('button[aria-label="글자 크기 줄이기"]').click()
    await page.locator('button[aria-label="글자 크기 줄이기"]').click()
    await page.waitForTimeout(250)
    expect(await size.inputValue()).toBe('11')

    // 키보드 — 입력칸에서 ↑↓
    await size.click()
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(250)
    expect(await size.inputValue()).toBe('12')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(250)
    expect(await size.inputValue()).toBe('11')

    // 워드식 글자 크게/작게 — 표준 크기 사다리를 따라간다
    await page.locator('button[aria-label="글자 크게"]').click()
    await page.waitForTimeout(250)
    expect(await size.inputValue()).toBe('12')
  })

  test('적용한 글자 모양은 저장했다 다시 열어도 남는다', async ({ page }) => {
    const editor = await openDoc(page)
    await setBox(page, '글자 크기', '15')
    await setBox(page, '자간', '10')
    await setBox(page, '장평', '90')
    await page.waitForTimeout(2200)

    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible' })
    await page.waitForTimeout(800)
    const html = await editor.innerHTML()
    expect(html).toContain('font-size: 15pt')
    expect(html).toContain('letter-spacing: 0.1em')
    expect(html).toContain('data-char-scale="90"')
  })

  test('문서 기본값(문서 스타일)도 입력과 증감 단추로 바꿀 수 있다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.getByRole('tab', { name: '서식', exact: true }).click()
    await page.locator('.jan-ribbon-body .jan-ribbon-btn[aria-label="문서 스타일"]').click()
    await page.locator('.jan-typography-modal').waitFor()

    // 미리 정해 둔 눈금 밖의 값도 직접 넣을 수 있다 (예전 슬라이더는 10~22px 로 막혀 있었다)
    const size = page.locator('input[aria-label="기본 글자 크기"]')
    await size.fill('27')
    await size.press('Enter')
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ProseMirror')!).fontSize)).toBe('27px')

    const line = page.locator('input[aria-label="기본 줄 간격"]')
    await line.fill('2.6')
    await line.press('Enter')
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--jan-editor-line').trim())).toBe('2.6')

    await page.locator('button[aria-label="단락 간격 늘리기"]').click()
    await page.waitForTimeout(250)
    expect(Number(await page.locator('input[aria-label="단락 간격"]').inputValue())).toBeGreaterThan(0)

    // 이 컴퓨터 글꼴을 문서 기본 글꼴로
    await page.locator('.jan-typography-modal .jan-fontcombo-btn').click()
    await page.locator('.jan-fontcombo-search').fill('georgia')
    await page.waitForTimeout(250)
    await page.locator('.jan-typography-modal .jan-fontcombo-list .jan-fontcombo-item').nth(1).click()
    await page.waitForTimeout(350)
    const stack = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--jan-editor-font'))
    expect(stack.toLowerCase()).toContain('georgia')
  })

  test('값을 지정하지 않았을 때도 지금 적용된 기본값이 보인다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    const shown = await page.evaluate(() => {
      const val = (label: string) => (document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement)?.value
      const inherited = (label: string) => !!document.querySelector(`input[aria-label="${label}"]`)?.closest('.jan-spin')?.classList.contains('is-inherited')
      return {
        size: val('글자 크기'), sizeDim: inherited('글자 크기'),
        line: val('줄 간격'),
        spacing: val('자간'), scale: val('장평'),
      }
    })
    // 빈칸이 아니라 문서 기본값이 보이고, 직접 정한 값과 구별되게 흐리다
    expect(Number(shown.size)).toBeGreaterThan(0)
    expect(shown.sizeDim).toBe(true)
    expect(Number(shown.line)).toBeGreaterThan(0)
    expect(shown.spacing).toBe('0')
    expect(shown.scale).toBe('100')
  })

  test('자주 쓰는 값 목록은 입력칸을 가리지 않고 아래에 열린다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.locator('button[aria-label="글자 크기 자주 쓰는 값"]').click()
    const pop = page.locator('.jan-spin-pop')
    await expect(pop).toBeVisible()

    const geom = await page.evaluate(() => {
      const box = document.querySelector('.jan-spin')!.getBoundingClientRect()
      const pop = document.querySelector('.jan-spin-pop')!.getBoundingClientRect()
      return { boxBottom: box.bottom, popTop: pop.top }
    })
    expect(geom.popTop).toBeGreaterThanOrEqual(geom.boxBottom - 1)

    await pop.locator('.jan-spin-pop-item', { hasText: '18' }).first().click()
    await page.waitForTimeout(300)
    expect(await page.locator('input[aria-label="글자 크기"]').inputValue()).toBe('18')
  })

  test('머리부(헤더·탭·리본·서식줄)가 화면 세로를 지나치게 먹지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(400)

    const m = await page.evaluate(() => {
      const h = (s: string) => Math.round(document.querySelector(s)?.getBoundingClientRect().height || 0)
      const top = Math.round(document.querySelector('.jan-editor-pages')!.getBoundingClientRect().top)
      return { top, ratio: top / window.innerHeight, header: h('.jan-ribbon-bar'), tabs: h('.jan-memo-tabs'), toolbar: h('.jan-toolbar-row') }
    })
    // 문서가 시작되는 지점이 화면의 4분의 1을 넘지 않아야 한다
    expect(m.ratio).toBeLessThan(0.25)
    expect(m.header).toBeLessThanOrEqual(36) // 통합 바 (로고·문서탭·리본탭·아이콘)
    expect(m.tabs).toBeLessThanOrEqual(28)
    expect(m.toolbar).toBeLessThanOrEqual(36)
    // 머리부는 두 띠(통합 바+리본 본문 / 서식줄)로만 이뤄진다
    expect(m.top).toBeLessThan(170)

    // 리본을 접으면 더 줄어든다 (한글·워드의 리본 접기)
    await page.locator('.jan-ribbon-collapse').click()
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => Math.round(document.querySelector('.jan-editor-pages')!.getBoundingClientRect().top))
    expect(after).toBeLessThanOrEqual(m.top - 38)
  })

  test('아이콘에 마우스를 올리면 그림이 있는 설명 카드가 뜬다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.locator('[data-help="cmd-palette"]').first().hover()
    const card = page.locator('.jan-help-tip')
    await expect(card).toBeVisible({ timeout: 3000 })
    await expect(card.locator('.jan-help-title')).toHaveText('명령 팔레트')
    await expect(card.locator('.jan-help-key')).toHaveText('Ctrl+Shift+P')
    expect(await card.locator('svg').count()).toBeGreaterThan(0)          // 인포그래픽
    expect((await card.locator('.jan-help-summary').innerText()).length).toBeGreaterThan(20)
    await expect(card.locator('.jan-help-when-tag')).toHaveText('이럴 때')

    // 리본 단추에도 붙는다 (안내를 적어 둔 것은 자세히, 나머지는 이름·단축키로)
    await page.mouse.move(600, 500)
    await page.getByRole('tab', { name: '삽입', exact: true }).click()
    await page.locator('.jan-ribbon-btn[aria-label^="표 삽입"]').first().hover()
    await expect(card).toBeVisible({ timeout: 3000 })
    await expect(card.locator('.jan-help-title')).toHaveText('표 넣기')

    // Esc 로 닫힌다
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
  })

  test('상단 바는 흰 글자가 또렷하게 보이는 어두운 보라다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    const bar = await page.evaluate(() => {
      const h = document.querySelector('.jan-ribbon-bar')!
      const cs = getComputedStyle(h)
      const lum = (rgb: string) => {
        const [r, g, b] = (rgb.match(/\d+/g) || ['0', '0', '0']).map(Number).map((v) => {
          const c = v / 255
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      // 배경은 그라데이션이라 중간색(#50419E 근처)을 기준으로 잡는다
      const bg = cs.backgroundImage.match(/rgb\([^)]+\)/g) || [cs.backgroundColor]
      const bgLum = bg.map(lum).reduce((a, b2) => a + b2, 0) / bg.length
      const fgLum = lum(cs.color)
      const contrast = (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05)
      return { contrast, buttons: h.querySelectorAll('.jan-header-btn').length }
    })
    expect(bar.contrast).toBeGreaterThan(4.5)   // 본문 기준 WCAG AA
    expect(bar.buttons).toBeLessThanOrEqual(12) // 아이콘 과밀 방지 (예전 23개)
  })

  test('리본은 문서 작업 탭과 부가 탭이 구분되고, 같은 기능이 두 탭에 겹치지 않는다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => ({
      label: (t.textContent || '').trim(),
      extra: t.classList.contains('is-extra'),
    })))
    expect(tabs.filter((t) => !t.extra).map((t) => t.label)).toEqual(['파일', '편집', '보기', '삽입', '서식', '쪽', '검토'])
    expect(tabs.filter((t) => t.extra).map((t) => t.label)).toEqual(['AI', '논문'])
    await expect(page.locator('.jan-ribbon-tab-split')).toHaveCount(1) // 코어와 부가 사이 경계선

    // 같은 기능이 두 탭에 있으면 어디서 하는 일인지 헷갈린다 — 겹침 0 을 지킨다
    const seen = new Map<string, string[]>()
    for (const t of ['파일', '편집', '보기', '삽입', '서식', '쪽', '검토', 'AI', '논문']) {
      await page.getByRole('tab', { name: t, exact: true }).click()
      await page.waitForTimeout(120)
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll('.jan-ribbon-body .jan-ribbon-btn')]
          .map((b) => b.getAttribute('aria-label') || '')
          .filter((l) => l && !l.endsWith('더보기'))
      )
      for (const l of new Set(labels)) seen.set(l, [...(seen.get(l) || []), t])
    }
    const dupes = [...seen.entries()].filter(([, ts]) => ts.length > 1)
    expect(dupes).toEqual([])
  })

  test('유틸은 유틸끼리 — 더보기 메뉴가 갈래로 나뉘어 있다', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.jan-header-more-btn').click()

    const menu = page.locator('.jan-header-more-menu')
    await expect(menu).toBeVisible()
    const sections = await menu.locator('.jan-more-sec-title').allInnerTexts()
    expect(sections.length).toBeGreaterThanOrEqual(4)
    expect(sections).toContain('만들기 도구')
    expect(await menu.getByRole('menuitem').count()).toBeGreaterThanOrEqual(16)
  })
})
