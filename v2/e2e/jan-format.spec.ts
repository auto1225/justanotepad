import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 우리 문서 형식 (.jan) — 워드의 .docx, 한글의 .hwpx 자리.
 * 본문·쪽 설정·그림을 한 묶음에 담고, 열면 그대로 되살아나야 한다.
 */

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

async function columnLabel(page: Page) {
  const chip = page.locator('.jan-page-status-chip', { hasText: '단' }).first()
  return (await chip.innerText()).match(/(\d)단/)?.[1] ?? '?'
}

test.describe('우리 문서 형식 (.jan)', () => {
  test('저장한 .jan 을 열면 본문·그림·쪽 설정이 그대로 살아난다', async ({ page }) => {
    await ready(page)

    // 그림이 든 문서를 .jan 으로 싸서, 그 파일을 여는 상황을 만든다
    await page.evaluate(async () => {
      const mod = await import('/v2/src/lib/janFormat.ts')
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await mod.packJan({
        title: '묶음 문서',
        html: `<h1>묶음 문서</h1><p>본문 한 줄</p><img src="${png}" alt="그림">`,
        pageSettings: { pageColumnCount: 2 },
      })
      const file = new File([blob], '묶음 문서.jan', { type: mod.JAN_MIME })
      ;(window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker = async () => [{
        getFile: async () => file,
      }]
    })

    await ribbonTab(page, '파일')
    await page.locator('button[aria-label^="열기"]').first().click()

    await expect(page.locator('.ProseMirror')).toContainText('본문 한 줄', { timeout: 10000 })
    await expect(page.locator('.ProseMirror img')).toHaveCount(1)
    await expect.poll(() => columnLabel(page)).toBe('2')
  })

  test('그림은 본문이 아니라 묶음 안 파일로 담긴다', async ({ page }) => {
    await ready(page)
    const report = await page.evaluate(async () => {
      const mod = await import('/v2/src/lib/janFormat.ts')
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const blob = await mod.packJan({ title: 't', html: `<p><img src="${png}"></p>`, pageSettings: {} })
      const raw = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()))
      const back = await mod.unpackJan(await blob.arrayBuffer())
      return {
        hasMediaEntry: raw.includes('media/m1.png'),
        hasMime: raw.includes('application/x-justanotepad+zip'),
        restored: back.html.includes('data:image/png'),
      }
    })
    expect(report).toEqual({ hasMediaEntry: true, hasMime: true, restored: true })
  })
})
