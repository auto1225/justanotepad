import { expect, test, type Page } from '@playwright/test'

const DB_NAME = 'jan-v2-local-first'
const STORE_NAME = 'kv'
const MEMOS_KEY = 'jan:v2:memos'

async function readPersistedValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate(
    async ({ dbName, storeName, storageKey }) =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1)

        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
        }

        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(storeName, 'readonly')
          const getRequest = tx.objectStore(storeName).get(storageKey)
          getRequest.onerror = () => reject(getRequest.error || tx.error || new Error('IndexedDB read failed'))
          getRequest.onsuccess = () => {
            const value = getRequest.result
            resolve(typeof value === 'string' ? value : null)
            db.close()
          }
        }
      }),
    { dbName: DB_NAME, storeName: STORE_NAME, storageKey: key }
  )
}

test.describe('local-first memo storage', () => {
  test('persists memo content in IndexedDB without keeping a localStorage duplicate', async ({ page }) => {
    await page.goto('./')

    const marker = `Local-first E2E ${Date.now()}`
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.type(marker)

    await expect(editor).toContainText(marker)
    await expect.poll(() => readPersistedValue(page, MEMOS_KEY), { timeout: 10000 }).toContain(marker)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), MEMOS_KEY)).toBeNull()
  })

  test('migrates existing localStorage memo data into IndexedDB on first load', async ({ page }) => {
    const now = Date.now()
    const memoId = `legacy_${now}`
    const legacyText = `Migrated localStorage memo ${now}`
    const legacyPayload = {
      state: {
        memos: {
          [memoId]: {
            id: memoId,
            title: 'Legacy memo',
            content: `<p>${legacyText}</p>`,
            createdAt: now,
            updatedAt: now,
          },
        },
        trashed: {},
        currentId: memoId,
        order: [memoId],
        sortMode: 'recent',
      },
      version: 2,
    }

    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value))
      },
      { key: MEMOS_KEY, value: legacyPayload }
    )

    await page.goto('./')

    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toContainText(legacyText, { timeout: 15000 })
    await expect.poll(() => readPersistedValue(page, MEMOS_KEY), { timeout: 10000 }).toContain(legacyText)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), MEMOS_KEY)).toBeNull()
  })

  test('stores pasted images as local blob references instead of inline data URLs', async ({ page }) => {
    await page.goto('./')

    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()

    await page.evaluate(() => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const file = new File([bytes], 'dot.png', { type: 'image/png' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      const event = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', { value: transfer })
      document.querySelector('.ProseMirror')?.dispatchEvent(event)
    })

    await expect(editor.locator('img')).toHaveCount(1, { timeout: 10000 })
    await expect.poll(() => readPersistedValue(page, MEMOS_KEY), { timeout: 10000 }).toContain('jan-blob://')
    const persisted = await readPersistedValue(page, MEMOS_KEY)
    expect(persisted).not.toContain('data:image/png;base64')
  })

  test('shows local storage status responsively in settings', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./')

    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.keyboard.press('Control+,')

    const modal = page.locator('.jan-settings-modal')
    await expect(modal).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.jan-settings-storage-section')).toContainText('IndexedDB')
    await expect(page.locator('.jan-settings-storage-section')).toContainText('이미지 블롭')
    await expect(page.locator('.jan-settings-byoc-section')).toContainText('개인 저장소 동기화')
    await expect(page.locator('.jan-settings-byoc-section')).toContainText('내 PC/클라우드 폴더')
    await expect(page.locator('.jan-settings-byoc-section')).toContainText('Dropbox 직접 연결')
    const googleDriveFolder = page.locator('.jan-settings-byoc-section').getByRole('button', { name: /Google Drive 데스크톱 폴더/ })
    await expect(googleDriveFolder).toBeEnabled()
    await expect(googleDriveFolder).toContainText('Drive for desktop')

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('keeps mobile header actions and toolbar menus reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./')

    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    const moreButton = page.getByRole('button', { name: '더보기' })
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    const moreMenu = page.locator('.jan-header-more-menu')
    await expect(moreMenu).toBeVisible()
    await expect(moreMenu.getByRole('button', { name: '명함' })).toBeVisible()
    await moreMenu.getByRole('button', { name: '설정' }).click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible({ timeout: 15000 })
    await page.locator('.jan-settings-modal').getByRole('button', { name: '닫기' }).click()

    // 리본 — 좁은 화면에서도 탭과 명령이 화면 안에 들어온다
    await page.getByRole('tab', { name: '쪽', exact: true }).click()
    const ribbon = page.locator('.jan-ribbon-body')
    await expect(ribbon).toBeVisible()
    const box = await ribbon.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(Math.ceil(box!.x + box!.width)).toBeLessThanOrEqual(390)
  })
})
