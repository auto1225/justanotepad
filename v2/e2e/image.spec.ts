import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 그림 개체 — 워드의 「그림 서식」 을 옮긴 것들이 실제로 작동하는지.
 * 모든 확인은 마우스가 아니라 키보드로 한다 (마우스로 되는 일은 키보드로도 된다는 규칙).
 */

/** 32×16 짜리 작은 PNG — 원래 크기를 읽는지 확인하기 좋다 */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAYAAAB3AH1ZAAAAOklEQVR42u3PMQEAAAgDoC251a3gGWQgnbozAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAtHnMBAY3xUswAAAAASUVORK5CYII='

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

async function pasteImage(page: Page) {
  await page.evaluate((src) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', `<img src="${src}">`)
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, PNG)
  await expect(page.locator('.ProseMirror img')).toHaveCount(1)
  // 원래 크기를 읽어 넣을 때까지 기다린다 — 「원래 크기로」·세로 자르기가 이 값을 쓴다
  await expect(page.locator('.ProseMirror img')).toHaveAttribute('data-nw', '32')
}

test.describe('그림 개체', () => {
  test('그림을 고르면 크기·회전 손잡이가 붙는다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n') // 다음 그림 고르기
    // 여덟 방향 + 회전 — 워드와 같은 구성
    await expect(page.locator('.jan-ih-dot')).toHaveCount(8)
    await expect(page.locator('.jan-ih-rotate')).toHaveCount(1)
  })

  test('키보드만으로 크기·회전·대칭·배치를 바꾼다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')
    const img = page.locator('.ProseMirror img')

    await page.keyboard.press('Shift+ArrowRight')
    await expect(img).toHaveAttribute('data-width', '44px')

    await page.keyboard.press('Alt+r')
    await expect(img).toHaveAttribute('data-rotate', '90')

    await page.keyboard.press('Alt+h')
    await expect(img).toHaveAttribute('data-flip-h', '1')

    // 배치는 차례로 돈다 — 위/아래 → 글자처럼
    await page.keyboard.press('Alt+w')
    await expect(img).toHaveAttribute('data-wrap', 'inline')

    await page.keyboard.press('Alt+0') // 원래 크기로
    await expect(img).toHaveAttribute('data-width', '32px')
  })

  test('자르기는 원본을 건드리지 않는다 — 되돌리면 그대로다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')
    const img = page.locator('.ProseMirror img')

    await page.keyboard.press('Alt+Shift+ArrowLeft')
    await expect(img).toHaveAttribute('data-crop', /0\.02$/)
    // 잘린 그림은 감싸는 span 이 넘치는 부분을 가린다
    await expect(page.locator('.ProseMirror span.jan-img')).toHaveCount(1)

    await page.keyboard.press('Alt+x')
    await expect(img).not.toHaveAttribute('data-crop', /./)
  })

  test('감싸기를 켜면 글이 그림 옆으로 흐른다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.type('옆으로 흐르는 문장. '.repeat(20))
    await page.keyboard.press('Alt+n')

    // 배치 순환: 위/아래 → 글자처럼 → 왼쪽 감쌈
    await page.keyboard.press('Alt+w')
    await page.keyboard.press('Alt+w')
    await expect(page.locator('.ProseMirror img')).toHaveAttribute('data-wrap', 'left')

    const floated = await page.locator('.ProseMirror img').evaluate((el) => getComputedStyle(el).float)
    expect(floated).toBe('left')
  })

  test('캡션은 그림의 일부다 — 저장했다 다시 열어도 붙어 있다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')

    await page.keyboard.press('Alt+c') // 캡션 갈피가 열린다
    await expect(page.locator('.jan-imgdlg')).toBeVisible()
    await page.locator('#jan-cap-text').fill('그림 1. 주차 센서 배치')
    await page.keyboard.press('Enter')

    await expect(page.locator('.ProseMirror .jan-img-cap')).toHaveText('그림 1. 주차 센서 배치')

    await page.waitForTimeout(1200) // 자동 저장
    await page.reload()
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await expect(page.locator('.ProseMirror .jan-img-cap')).toHaveText('그림 1. 주차 센서 배치')
    // 캡션 글자가 본문 글자로 새어 나오지 않는다
    await expect(page.locator('.ProseMirror img')).toHaveCount(1)
  })

  test('속성 창은 여섯 갈피가 있고 화살표로 옮겨 다닌다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')
    await page.keyboard.press('Alt+p')

    const tabs = page.locator('.jan-imgdlg-tabs button')
    await expect(tabs).toHaveCount(6)
    await expect(tabs.first()).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
  })

  test('Shift+F10 으로 그림 메뉴가 열리고 화살표로 고른다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')
    await page.keyboard.press('Shift+F10')

    const menu = page.locator('.jan-img-ctx')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: /캡션 넣기/ })).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
  })

  test('개체 보호를 걸면 크기가 바뀌지 않는다', async ({ page }) => {
    await freshEditor(page)
    await pasteImage(page)
    await page.keyboard.press('Alt+n')
    await page.keyboard.press('Alt+l') // 보호 켬
    await expect(page.locator('.ProseMirror img')).toHaveAttribute('data-locked', '1')

    await page.keyboard.press('Shift+ArrowRight')
    await expect(page.locator('.ProseMirror img')).not.toHaveAttribute('data-width', /./)

    await page.keyboard.press('Alt+l') // 보호 풂
    await page.keyboard.press('Shift+ArrowRight')
    await expect(page.locator('.ProseMirror img')).toHaveAttribute('data-width', '44px')
  })
})
