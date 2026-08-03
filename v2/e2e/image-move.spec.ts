import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * 그림을 끌어 옮겨도 복사되지 않아야 한다.
 *
 * 브라우저의 끌어놓기는 집어 든 자리를 기억했다가 놓을 때 거기를 지운다. 그런데 끄는 사이
 * 쪽이 다시 짜여 그림이 다른 자리로 가면 원래 자리를 못 찾아 지우지 못하고 넣기만 한다 —
 * 그림이 둘이 된다. 여백에 닿을 때 · 표 선에 닿을 때 · 쪽을 넘길 때가 모두 쪽이 다시 짜이는
 * 순간이라 꼭 그때 벌어졌다.
 *
 * 그래서 옮기는 일을 우리가 직접 한다 — 지금 문서에서 그 그림이 어디 있는지 보고 지우고,
 * 넣기와 한 트랜잭션으로 묶는다.
 *
 * 밝혀 둘 것: 이 시험은 그 고장을 재현하지 못한다. 손으로 만든 DragEvent 는 브라우저의
 * 진짜 끌어놓기 경로를 타지 않아, 고침을 빼도 통과한다. 여기서 지키는 것은 「끄는 사이
 * 문서가 바뀌어도 옮기기가 그림을 늘리지 않는다」 는 약속뿐이다. 실제 고장은 사람이
 * 마우스로 끌어 확인해야 한다.
 */

const BIG = path.join(process.cwd(), 'e2e', 'fixtures', 'big.png')

test('끄는 사이 문서가 바뀌어도 그림이 복사되지 않는다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.keyboard.type('첫 줄')
  await page.keyboard.press('Enter')
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(BIG)
  await expect(doc.locator('img')).toHaveCount(1)
  await doc.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('여기로 옮긴다')
  await page.waitForTimeout(1200)

  const 결과 = await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: any }).__janEditor
    const count = () => { let n = 0; e.state.doc.descendants((nd: any) => { if (nd.type.name === 'image') n += 1 }); return n }
    const 전 = count()

    /* 그림을 고르고 끌기를 시작한다 */
    let pos = -1
    e.state.doc.descendants((n: any, p: number) => { if (pos < 0 && n.type.name === 'image') pos = p })
    e.commands.setNodeSelection(pos)
    const img = document.querySelector('.ProseMirror img') as HTMLElement
    const dt = new DataTransfer()
    const r = img.getBoundingClientRect()
    img.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 }))

    /* 끄는 사이 문서가 바뀐다 — 쪽이 다시 짜여 그림이 옮겨지는 상황과 같다.
       맨 앞에 문단을 넣으면 그림의 자리가 뒤로 밀린다. */
    e.view.dispatch(e.state.tr.insert(1, e.state.schema.nodes.paragraph.create(null, e.state.schema.text('끼어든 줄'))))

    /* 이제 놓는다 — 마지막 문단 위에 */
    const ps = [...document.querySelectorAll('.ProseMirror p')]
    const last = ps[ps.length - 1]
    const lr = last.getBoundingClientRect()
    last.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: lr.x + 10, clientY: lr.y + lr.height / 2 }))
    return { 전, 후: count() }
  })

  await page.waitForTimeout(1500)
  const 마지막 = await page.evaluate(() => {
    const e = (window as unknown as { __janEditor: any }).__janEditor
    let n = 0
    e.state.doc.descendants((nd: any) => { if (nd.type.name === 'image') n += 1 })
    return n
  })
  /* 끌기 전에도 하나, 놓은 뒤에도 하나 — 옮겨질 뿐 늘어나지 않는다 */
  expect(결과.전).toBe(1)
  expect(결과.후).toBe(1)
  expect(마지막).toBe(1)
})
