import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 그리기 개체 — 워드의 「도형 · 아이콘 · WordArt · 텍스트 상자」,
 * 한글의 「도형 · 그리기마당 · 글맵시 · 글상자」.
 * 그림과 같은 키로 다뤄지는지까지 함께 본다.
 */

async function freshEditor(page: Page) {
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

async function openGallery(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } })))
  // 갤러리가 첫 모양에 초점을 줄 때까지 기다린다 — 그래야 Enter 가 먹는다
  await expect(page.locator('.jan-shapedlg-grid button').first()).toBeFocused()
}

test.describe('그리기 개체', () => {
  test('갤러리는 갈래별로 모양을 보여 주고 키보드로 고른다', async ({ page }) => {
    await freshEditor(page)
    await openGallery(page)

    const dlg = page.locator('.jan-shapedlg')
    await expect(dlg).toBeVisible()
    // 워드의 도형 갈래 일곱 (선·사각형·기본 도형·블록 화살표·순서도·별 및 현수막·설명선)
    await expect(page.locator('.jan-shapedlg-groups button')).toHaveCount(7)

    // 화살표로 옮겨 다니고 Enter 로 넣는다
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(page.locator('.ProseMirror .jan-shape')).toHaveCount(1)
    // 진짜 SVG 로 그려진다 (네임스페이스가 맞아야 화면에 나온다)
    const ns = await page.locator('.ProseMirror .jan-shape svg').evaluate((el) => el.namespaceURI)
    expect(ns).toBe('http://www.w3.org/2000/svg')
  })

  test('도형도 그림과 같은 키로 다룬다', async ({ page }) => {
    await freshEditor(page)
    await openGallery(page)
    await page.keyboard.press('Enter')
    const shape = page.locator('.ProseMirror .jan-shape').first()
    await expect(shape).toHaveCount(1)

    await page.keyboard.press('Alt+s') // 다음 도형 고르기
    await page.keyboard.press('Shift+ArrowRight')
    await expect(shape).toHaveAttribute('data-w', '252')

    await page.keyboard.press('Alt+r')
    await expect(shape).toHaveAttribute('data-rotate', '90')

    await page.keyboard.press('Alt+w')
    await expect(shape).toHaveAttribute('data-wrap', 'inline')

    await page.keyboard.press('Alt+l') // 개체 보호
    await expect(shape).toHaveAttribute('data-locked', '1')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(shape).toHaveAttribute('data-w', '252') // 보호 중에는 안 바뀐다
  })

  test('글상자는 세로쓰기가 되고 글자 방향이 돌아간다', async ({ page }) => {
    await freshEditor(page)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'insert' } })))
    await page.locator('.jan-imgdlg-tabs button', { hasText: '글상자' }).click()
    await page.getByRole('button', { name: /세로 글상자 넣기/ }).click()

    const box = page.locator('.ProseMirror .jan-shape-textbox')
    await expect(box).toHaveCount(1)
    await expect(box).toHaveAttribute('data-text-dir', 'vertical')
    const mode = await page.locator('.ProseMirror .jan-shape-text').evaluate((el) => getComputedStyle(el).writingMode)
    expect(mode).toContain('vertical')

    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Alt+d') // 글자 방향 차례로
    await expect(box).toHaveAttribute('data-text-dir', 'rotate270')
  })

  test('글맵시는 길을 따라 글자가 흐른다', async ({ page }) => {
    await freshEditor(page)
    await openGallery(page)
    await page.locator('.jan-imgdlg-tabs button', { hasText: '글맵시' }).click()
    await page.locator('.jan-shapedlg-grid button').nth(1).click() // 위로 굽은 활

    await expect(page.locator('.ProseMirror .jan-shape-wordart')).toHaveCount(1)
    await expect(page.locator('.ProseMirror .jan-shape-wordart textPath')).toHaveCount(1)
  })

  test('넣은 개체는 저장했다 다시 열어도 그대로다', async ({ page }) => {
    await freshEditor(page)
    await openGallery(page)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Alt+s')
    await page.keyboard.press('Alt+r')
    await expect(page.locator('.ProseMirror .jan-shape')).toHaveAttribute('data-rotate', '90')

    await page.waitForTimeout(1200)
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await expect(page.locator('.ProseMirror .jan-shape')).toHaveCount(1)
    await expect(page.locator('.ProseMirror .jan-shape')).toHaveAttribute('data-rotate', '90')
    await expect(page.locator('.ProseMirror .jan-shape svg')).toHaveCount(1)
  })
})
