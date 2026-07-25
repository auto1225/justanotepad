import { test, expect } from '@playwright/test'

/**
 * 서식 도구 상자 — 이 컴퓨터 글꼴 목록, 그리고 크기·줄간격·자간·장평의
 * 직접 입력 / 증감 단추 / 키보드 조작이 선택 영역에 실제로 적용되는지.
 */
test.describe('글자 모양 도구 상자', () => {
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
})
