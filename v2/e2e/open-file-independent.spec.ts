import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 파일로 연 문서는 완전히 별개다 —
 * 보고 있던 문서(예: 2단 논문)의 판형이 새로 연 문서에 묻어나면 안 된다.
 * 워드가 문서마다 쪽 설정을 따로 갖는 것과 같다.
 */

const PLAIN_FILE = '<!doctype html><html><head><meta charset="utf-8"><title>남이 준 문서</title></head>' +
  '<body><h1>남이 준 문서</h1><p>이 문서는 한 단짜리다.</p></body></html>'

const TWO_COLUMN_FILE = '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="jan-page-settings" content="{&quot;pageColumnCount&quot;:2}">' +
  '<title>2단 문서</title></head><body><p>두 단으로 짠 문서</p></body></html>'

async function ready(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  return editor
}

async function ribbonTab(page: Page, name: string) {
  await page.locator('.jan-ribbon-tab', { hasText: new RegExp(`^${name}$`) }).first().click()
}

/** 파일 고르기 창을 흉내 낸다 — 실제 창은 자동화가 다룰 수 없다 */
async function openStubbedFile(page: Page, html: string, name: string) {
  await page.evaluate(({ html: source, name: fileName }) => {
    const win = window as unknown as { showOpenFilePicker?: unknown }
    win.showOpenFilePicker = async () => [{
      getFile: async () => new File([source], fileName, { type: 'text/html' }),
    }]
  }, { html, name })
  await ribbonTab(page, '파일')
  await page.locator('button[aria-label^="열기"]').first().click()
}

/** 지금 문서의 단 수 — 상태 막대의 쪽 정보 칩에 적혀 있다 */
async function columnLabel(page: Page) {
  const chip = page.locator('.jan-page-status-chip', { hasText: '단' }).first()
  return (await chip.innerText()).match(/(\d)단/)?.[1] ?? '?'
}

test.describe('파일 열기의 문서 독립성', () => {
  test('2단 문서를 보다가 파일을 열면 그 문서는 1단(기본 판형)으로 열린다', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('논문 본문')

    await ribbonTab(page, '레이아웃')
    await page.locator('button[aria-label^="다단"]').first().click()
    await page.locator('.jan-ribbon-dropdown button').filter({ hasText: '다단: 둘' }).first().click()
    await expect.poll(() => columnLabel(page)).toBe('2')

    await openStubbedFile(page, PLAIN_FILE, '남이 준 문서.html')

    await expect(page.locator('.ProseMirror')).toContainText('이 문서는 한 단짜리다', { timeout: 10000 })
    await expect.poll(() => columnLabel(page)).toBe('1')
  })

  test('파일에 적힌 판형이 있으면 그대로 살아난다', async ({ page }) => {
    await ready(page)
    await openStubbedFile(page, TWO_COLUMN_FILE, '2단 문서.html')

    await expect(page.locator('.ProseMirror')).toContainText('두 단으로 짠 문서', { timeout: 10000 })
    await expect.poll(() => columnLabel(page)).toBe('2')
  })

  test('파일을 열면 원래 문서는 그대로 두고 새 문서로 열린다', async ({ page }) => {
    const editor = await ready(page)
    await editor.click()
    await page.keyboard.type('원래 보던 문서')
    const tabs = page.locator('.jan-memo-tab')
    const before = await tabs.count()

    await openStubbedFile(page, PLAIN_FILE, '남이 준 문서.html')
    await expect(page.locator('.ProseMirror')).toContainText('이 문서는 한 단짜리다', { timeout: 10000 })

    // 새 문서로 열렸고(탭 하나 늘고), 원래 문서도 목록에 그대로 남아 있다
    await expect(tabs).toHaveCount(before + 1)
    await expect(page.locator('.jan-memo-tab-title', { hasText: '남이 준 문서' })).toHaveCount(1)
  })
})
