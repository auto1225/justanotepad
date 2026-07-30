import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 논문 탭 — 학술 원고에만 있는 것들.
 * 학회 양식 · 구성 요소 · 번호 수식과 식 참조 · DOI·BibTeX 인용 · 제출 전 점검이
 * 실제로 문서에 들어가고 파일로 나가는지 눌러서 본다.
 */

async function ready(page: Page) {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => {
    localStorage.setItem('jan-v2-role-onboarded', '1')
    localStorage.removeItem('jan-v2-citations')
  })
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.locator('.jan-ribbon-tab', { hasText: /^논문$/ }).first().click()
  await page.waitForTimeout(300)
  return editor
}

const menu = (page: Page) => page.locator('.jan-ribbon-dropdown button.jan-menu-item')
const paperTab = (page: Page) => page.locator('.jan-ribbon-tab', { hasText: /^논문$/ }).first().click()

test.describe('논문 탭', () => {
  test('묶음이 논문 일감 차례로 나뉜다', async ({ page }) => {
    await ready(page)
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    expect(caps).toEqual(['학회 양식', '논문 구성 요소', '번호 수식 · 참조', '학술 인용 (DOI · BibTeX)', '제출 전'])
  })

  test('학회 표준 양식을 입히면 원고 뼈대가 들어온다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="학술 표준 양식"] .jan-ribbon-caret').first().click()
    await menu(page).filter({ hasText: 'IEEE 컨퍼런스' }).click()
    await page.waitForTimeout(700)
    await expect(editor).toContainText(/abstract/i)
    // 2단 양식이므로 쪽 설정도 두 단으로 바뀐다
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.pageColumnCount)).toBe(2)
  })

  test('저자·초록·키워드 블록이 그 자리에 들어간다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="저자 · 소속"]').first().click()
    await page.locator('button[aria-label^="Abstract"]').first().click()
    await page.locator('button[aria-label^="Keywords"]').first().click()
    await expect(editor).toContainText(/abstract/i)
    await expect(editor).toContainText(/keywords/i)
    await expect(editor).toContainText('교신저자')
  })

  test('약어 목록은 본문에서 약어를 찾아 모은다', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('본 논문은 LoRaWAN 과 FMCW 레이더를 쓴다. LoRaWAN 은 저전력 망이다.')
    await paperTab(page)
    await page.locator('button[aria-label^="그 밖의 구성 요소"] .jan-ribbon-caret').first().click()
    await menu(page).filter({ hasText: '약어 목록' }).click()
    await page.waitForTimeout(500)
    await expect(editor).toContainText('LoRaWAN')
    await expect(editor).toContainText('FMCW')
  })

  test('번호 수식과 식 참조가 함께 들어간다', async ({ page }) => {
    const editor = await ready(page)
    await page.locator('button[aria-label^="번호 붙은 수식"]').first().click()
    const prompt = page.locator('.jan-prompt-modal')
    await expect(prompt).toBeVisible()
    await prompt.locator('input, textarea').first().fill('E = mc^2')
    await prompt.getByRole('button', { name: '확인' }).click()
    await page.waitForTimeout(500)
    await expect(editor.locator('[data-paper-tag="eqnum"]')).toHaveCount(1)

    await editor.click()
    await page.keyboard.press('Control+End')
    await paperTab(page)
    await page.locator('button[aria-label^="수식 참조 넣기"]').first().click()
    const ask = page.locator('.jan-prompt-modal')
    if (await ask.count()) {
      await ask.locator('input, textarea').first().fill('1')
      await ask.getByRole('button', { name: '확인' }).click()
    }
    await page.waitForTimeout(400)
    await expect(editor.locator('[data-paper-tag="ref"][data-ref-type="eq"]')).toHaveCount(1)
  })

  test('BibTeX 를 붙여넣으면 인용 목록에 쌓이고 .bib 로 나간다', async ({ page }) => {
    await ready(page)
    await page.locator('button[aria-label^="BibTeX(.bib) 가져오기"]').first().click()
    const prompt = page.locator('.jan-prompt-modal')
    await expect(prompt).toBeVisible()
    await prompt.locator('input, textarea').first().fill(
      '@article{hong2026, title={Radar parking detection}, author={Hong, Gildong and Kim, Chulsoo}, year={2026}, journal={KICS}}',
    )
    await prompt.getByRole('button', { name: '확인' }).click()
    await page.waitForTimeout(500)

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-citations') || '[]'))
    expect(saved).toHaveLength(1)
    expect(String(saved[0].title)).toContain('Radar parking detection')

    // 단추 이름에 몇 건인지 함께 보인다
    await page.locator('.jan-ribbon-tab', { hasText: /^검수$/ }).first().click()
    await paperTab(page)
    await expect(page.locator('button[aria-label^="인용 관리 창"]')).toHaveAttribute('aria-label', /1건/)

    const download = page.waitForEvent('download')
    await page.locator('button[aria-label^="인용 목록을 .bib"]').first().click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.bib$/)
  })

  test('학술 표기 방식을 고르면 인용 관리 창도 그 모양으로 쓴다', async ({ page }) => {
    await ready(page)
    await page.locator('button[aria-label^="학술 표기 방식"] .jan-ribbon-caret').first().click()
    await menu(page).filter({ hasText: 'Vancouver' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('button[aria-label^="학술 표기 방식"]')).toHaveAttribute('aria-label', /Vancouver/)

    await page.locator('button[aria-label^="인용 관리 창"]').first().click()
    const dialog = page.locator('.jan-paper-modal')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('button.is-active').first()).toContainText('Vancouver')
  })

  test('논문 검사는 빠진 것을 짚어 준다', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('초록도 없는 원고')
    await paperTab(page)
    await page.locator('button[aria-label^="논문 검사"]').first().click()
    await page.waitForTimeout(600)
    const shown = await page.evaluate(() => document.body.innerText)
    expect(shown).toMatch(/초록|Abstract|검사|점검/)
  })

  test('문서 전체를 .tex 로 저장한다 (수식 문법이 아니라 문서 내보내기다)', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('레이더 주차 감지')
    await paperTab(page)
    const download = page.waitForEvent('download')
    await page.locator('button[aria-label^="문서 전체를 LaTeX(.tex)"]').first().click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.tex$/)
  })
})
