import { expect, test } from '@playwright/test'

test('probe extend timing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Delete')
  await page.evaluate(() => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', '<table><tbody><tr><td><p>A</p></td><td><p>B</p></td><td><p>C</p></td></tr><tr><td><p>D</p></td><td><p>E</p></td><td><p>F</p></td></tr><tr><td><p>G</p></td><td><p>H</p></td><td><p>I</p></td></tr></tbody></table>')
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.ProseMirror table td')).toHaveCount(9)
  await page.waitForTimeout(600)
  const state = () => page.evaluate(() => {
    const cells = [...document.querySelectorAll('.ProseMirror .selectedCell')].map((c) => c.textContent)
    const sel = window.getSelection()
    return { cells, dom: sel ? `${sel.anchorNode?.textContent?.slice(0,3)}→${sel.focusNode?.textContent?.slice(0,3)}` : '' }
  })
  await page.locator('.ProseMirror table td').nth(0).click()
  await page.waitForTimeout(200)
  console.log('클릭', JSON.stringify(await state()))
  await page.keyboard.press('Alt+s')
  console.log('Alt+S 직후', JSON.stringify(await state()))
  await page.keyboard.press('Shift+ArrowRight')
  console.log('Shift+→ 직후', JSON.stringify(await state()))
  await page.waitForTimeout(400)
  console.log('  400ms 뒤', JSON.stringify(await state()))
  await page.keyboard.press('Shift+ArrowDown')
  console.log('Shift+↓ 직후', JSON.stringify(await state()))
  await page.waitForTimeout(400)
  console.log('  400ms 뒤', JSON.stringify(await state()))
  expect(1).toBe(1)
})
