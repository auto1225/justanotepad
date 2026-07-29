import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * 워드 「삽입」 탭의 개체들 — 차트 · 스마트 도해 · 서명란 · 상호 참조 · 3D 모델.
 * 넣는 것으로 끝이 아니라, 문서에 살아 있는 개체로 남는지까지 본다.
 */

async function ready(page: Page) {
  await page.setViewportSize({ width: 1500, height: 940 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  const editor = page.locator('.ProseMirror').first()
  await editor.waitFor({ state: 'visible', timeout: 15000 })
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  return editor
}

async function insertTab(page: Page) {
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
}

test.describe('삽입 탭의 개체', () => {
  test('리본 묶음이 워드와 같은 차례로 나뉜다', async ({ page }) => {
    await ready(page)
    await insertTab(page)
    const caps = await page.locator('.jan-ribbon-group .jan-ribbon-cap').allInnerTexts()
    // 워드: 페이지 · 표 · 일러스트레이션 · 미디어 · 링크 · 메모 · 머리글/바닥글 · 텍스트 · 기호
    expect(caps.slice(0, 9)).toEqual(['페이지', '표', '일러스트레이션', '미디어', '링크', '메모', '머리글/바닥글', '텍스트', '기호'])
  })

  test('차트를 넣으면 문서에 그림과 데이터가 함께 남는다', async ({ page }) => {
    await ready(page)
    await insertTab(page)
    await page.locator('button[aria-label^="차트 (막대"]').first().click()
    const dialog = page.locator('.jan-chartdlg')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.jan-chartdlg-types button')).toHaveCount(9)
    await expect(dialog.locator('.jan-chartdlg-preview svg')).toBeVisible()

    // 종류를 바꾸면 미리보기도 바뀐다
    await dialog.locator('.jan-chartdlg-types button', { hasText: '원' }).first().click()
    await dialog.getByRole('button', { name: '넣기', exact: true }).click()

    const chart = page.locator('.ProseMirror figure[data-jan-chart]')
    await expect(chart).toHaveCount(1)
    await expect(chart.locator('svg')).toBeVisible()
    const spec = await chart.getAttribute('data-spec')
    expect(spec).toContain('"type":"pie"')
  })

  test('스마트 도해는 글 목록만 적으면 배치가 잡힌다', async ({ page }) => {
    await ready(page)
    await insertTab(page)
    await page.locator('button[aria-label^="스마트 도해"]').first().click()
    const dialog = page.locator('.jan-smartdlg')
    await expect(dialog).toBeVisible()
    await dialog.locator('textarea').fill('계획\n실행\n점검\n개선')
    await dialog.getByRole('button', { name: '넣기', exact: true }).click()

    const smart = page.locator('.ProseMirror figure[data-jan-smart]')
    await expect(smart).toHaveCount(1)
    const spec = await smart.getAttribute('data-spec')
    expect(spec).toContain('개선')
  })

  test('서명란은 이름과 날짜가 함께 남고, 손으로 서명할 칸이 있다', async ({ page }) => {
    await ready(page)
    await insertTab(page)
    await page.locator('button[aria-label^="서명란"]').first().click()
    const dialog = page.locator('.jan-signdlg')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('canvas.jan-signdlg-ink')).toBeVisible()
    await dialog.locator('input').first().fill('홍길동')
    await dialog.getByRole('button', { name: '서명란 넣기' }).click()

    const sign = page.locator('.ProseMirror div[data-jan-signature]')
    await expect(sign).toHaveCount(1)
    await expect(sign).toContainText('홍길동')
    await expect(sign).toContainText('날짜')
  })

  test('상호 참조는 가리킨 곳이 바뀌면 스스로 따라 바뀐다', async ({ page }) => {
    const editor = await ready(page)
    await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', '<p>앞글</p><table><tbody><tr><td><p>감지 방식</p></td></tr></tbody></table><p>참조: </p>')
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await expect(editor.locator('table')).toHaveCount(1)

    await insertTab(page)
    await page.locator('button[aria-label^="상호 참조"]').first().click()
    const dialog = page.locator('.jan-xrefdlg')
    await expect(dialog).toBeVisible()
    await dialog.locator('select').first().selectOption('table')
    await dialog.locator('.jan-xrefdlg-list button').first().click()
    await dialog.getByRole('button', { name: '넣기', exact: true }).click()

    const ref = page.locator('.ProseMirror span[data-jan-xref]')
    await expect(ref).toHaveText('표 1 — 감지 방식')

    // 가리킨 표의 글을 고치면 참조도 그 자리에서 바뀐다 (워드는 F9 를 눌러야 한다)
    await editor.locator('table td p').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' 비교')
    await expect(ref).toHaveText('표 1 — 감지 방식 비교')
  })

  test('3D 모델은 문서 안에서 돌려 볼 수 있는 그림판으로 열린다', async ({ page }) => {
    await ready(page)
    await page.evaluate(() => {
      // 작은 정사면체 STL 을 만들어 넣는다 (파일 고르기 창은 자동화가 다룰 수 없다)
      const tris = [
        [[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]],
        [[0, 0, 0], [0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      ]
      const buf = new ArrayBuffer(84 + tris.length * 50)
      const dv = new DataView(buf)
      dv.setUint32(80, tris.length, true)
      let o = 84
      for (const t of tris) {
        dv.setFloat32(o + 8, 1, true)
        let p = o + 12
        for (const v of t) { dv.setFloat32(p, v[0], true); dv.setFloat32(p + 4, v[1], true); dv.setFloat32(p + 8, v[2], true); p += 12 }
        o += 50
      }
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      const pm = document.querySelector('.ProseMirror') as HTMLElement
      pm.focus()
      const dt = new DataTransfer()
      dt.setData('text/html', `<figure data-jan-model3d="1" data-src="data:model/stl;base64,${b64}" data-format="stl" data-name="tetra.stl" data-w="240" data-h="180"></figure>`)
      pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })

    const canvas = page.locator('.ProseMirror figure.jan-model3d canvas')
    await expect(canvas).toHaveCount(1)
    await expect(page.locator('.jan-model3d-fail')).toHaveCount(0)
    // 그려졌는지 — 캔버스에 색이 찍혔는지로 본다
    await expect.poll(async () => page.evaluate(() => {
      const c = document.querySelector('.ProseMirror figure.jan-model3d canvas') as HTMLCanvasElement
      const gl = c.getContext('webgl')
      if (!gl) return 0
      // 캔버스 전체를 읽어 색이 찍힌 점을 센다 (모델이 가운데에만 있으란 법은 없다)
      const px = new Uint8Array(c.width * c.height * 4)
      gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
      let painted = 0
      for (let i = 3; i < px.length; i += 4) if (px[i] > 0) painted++
      return painted
    }), { timeout: 8000 }).toBeGreaterThan(200)
  })
})
