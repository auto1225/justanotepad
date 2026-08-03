import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * 그림 번호와 그것을 가리키는 참조는 문서가 바뀌면 스스로 따라가야 한다.
 *
 * 앞에 그림 하나를 끼워 넣으면 뒤의 번호가 한 칸씩 밀린다. 그런데 「번호 모두 다시 매기기」 를
 * 누를 때만 맞춰졌다 — 누르는 것을 잊으면 「그림 2에서 보듯」 이 다른 그림을 가리킨다.
 * 글이 조용히 틀리는 자리라 사람 손에 맡길 일이 아니다.
 */

const PNG = path.join(process.cwd(), 'e2e', 'fixtures', 'dot.png')

async function putImage(page: import('@playwright/test').Page) {
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.jan-ribbon-tab', { hasText: /^삽입$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="그림 넣기 (파일에서)"]').first().click()
  await (await chooser).setFiles(PNG)
  await page.waitForTimeout(600)
}

test('앞에 그림을 끼워 넣으면 뒤 그림의 번호가 스스로 밀린다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()

  /* 그림 하나에 캡션을 단다 — 그림 1 이 된다 */
  await putImage(page)
  await doc.click()
  await page.keyboard.press('Control+End')
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="캡션 넣기 (그림·표에 번호와 설명)"]').first().click()
  const ask = page.locator('.jan-modal-overlay').last()
  await ask.locator('input, textarea').first().fill('뒤에 오는 그림')
  await ask.getByRole('button', { name: '확인' }).first().click()
  await page.waitForTimeout(700)
  await expect(doc.locator('[data-paper-tag="figlabel"], .paper-figlabel').first()).toContainText('1')

  /* 문서 맨 앞에 그림을 하나 더 끼워 넣고 캡션을 단다 */
  await doc.click()
  await page.keyboard.press('Control+Home')
  await putImage(page)
  await doc.click()
  await page.keyboard.press('Control+Home')
  await page.locator('.jan-ribbon-tab', { hasText: /^자료$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label="캡션 넣기 (그림·표에 번호와 설명)"]').first().click()
  const ask2 = page.locator('.jan-modal-overlay').last()
  await ask2.locator('input, textarea').first().fill('앞에 끼운 그림')
  await ask2.getByRole('button', { name: '확인' }).first().click()

  /* 「번호 다시 매기기」 를 누르지 않아도 앞이 1, 뒤가 2 가 된다 */
  await expect(async () => {
    const labels = await doc.locator('[data-paper-tag="figlabel"], .paper-figlabel').allInnerTexts()
    expect(labels.length).toBe(2)
    expect(labels[0]).toContain('1')
    expect(labels[1]).toContain('2')
  }).toPass({ timeout: 8000 })
})

/**
 * 참조가 가리키던 그림을 지우면 — 조용히 남의 것을 가리키면 안 된다.
 *
 * 참조에는 대상마다 이름표(janRef)가 붙어 있다. 그 대상이 사라졌을 때 예전에는
 * 「몇 번째」 로 물러서서 그 자리에 들어선 다른 그림을 가리켰다. 재어 보니
 * 그림 다섯에 참조 다섯을 달고 셋째 그림만 지웠을 때
 *   전: 그림 1 · 그림 2 · 그림 3 · 그림 4 · 그림 5
 *   후: 그림 1 · 그림 2 · 그림 3 · 그림 3 · 그림 4
 * 셋째 참조가 「그림 3」 을 그대로 달고 있는데 그것은 이제 예전의 넷째 그림이다.
 * 두 참조가 같은 번호로 서로 다른 것을 뜻하고, 화면에는 아무 표도 나지 않는다.
 * 워드는 이럴 때 「오류! 참조 원본을 찾을 수 없습니다」 를 띄운다.
 *
 * 그리고 그 고침이 조판을 흔들어서는 안 된다 — 참조 글자 수가 바뀌므로 한 번은 돌지만
 * 곧 멎어야 한다.
 */

type XrefWin = Window & {
  __janEditor?: {
    commands: Record<string, (...a: unknown[]) => unknown>
    on: (e: string, f: (p: { transaction: { docChanged: boolean } }) => void) => void
    off: (e: string, f: (p: { transaction: { docChanged: boolean } }) => void) => void
  }
}

test('참조가 가리키던 그림을 지우면 남의 번호를 물려받지 않는다', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })
  await doc.click()
  await page.evaluate(() => {
    (window as XrefWin).__janEditor?.commands.clearContent(true)
  })
  await expect(doc.locator('img.jan-img-el')).toHaveCount(0)

  /* 캡션 단 그림 다섯 장 (캡션은 그림 노드의 속성이다) */
  const src = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180
    const cx = cv.getContext('2d')!; cx.fillStyle = '#37a'; cx.fillRect(0, 0, 240, 180)
    return cv.toDataURL('image/png')
  })
  await page.evaluate((s) => {
    let html = '<p>머리말이다.</p>'
    for (let i = 1; i <= 5; i += 1) {
      html += `<img src="${s}" data-nw="240" data-nh="180" data-caption="설명 ${i}">`
      html += `<p>여기는 ${i} 번째 그림 이야기다.</p>`
    }
    ;(window as XrefWin).__janEditor?.commands.setContent(html, { emitUpdate: true })
  }, src)
  await expect(doc.locator('img.jan-img-el')).toHaveCount(5)
  await page.waitForTimeout(1200)

  /* 본문 끝에 그림 1~5 를 가리키는 상호 참조를 단다 */
  await page.evaluate(() => {
    const ed = (window as XrefWin).__janEditor!
    ed.commands.focus('end')
    for (let i = 1; i <= 5; i += 1) {
      ed.commands.insertCrossRef({ kind: 'figure', targetId: `figure:${i}`, show: 'number' })
      ed.commands.insertContent(' · ')
    }
  })
  const xref = doc.locator('[data-jan-xref]')
  await expect(xref).toHaveCount(5)
  await expect(async () => {
    expect(await xref.allInnerTexts()).toEqual(['그림 1', '그림 2', '그림 3', '그림 4', '그림 5'])
  }).toPass({ timeout: 8000 })

  /* 셋째 그림만 지운다 — 그것을 가리키던 참조가 죽는다 */
  const 셈 = page.evaluate(async () => {
    const ed = (window as XrefWin).__janEditor!
    let 돈횟수 = 0
    let 마지막 = 0
    const t0 = performance.now()
    const on = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (!transaction.docChanged) return
      돈횟수 += 1
      마지막 = performance.now() - t0
    }
    ed.on('transaction', on)
    await new Promise((r) => setTimeout(r, 6000))
    ed.off('transaction', on)
    return { 돈횟수, 마지막: Math.round(마지막) }
  })
  await page.waitForTimeout(100)
  await page.evaluate(() => {
    const ed = (window as XrefWin).__janEditor! as unknown as {
      state: { doc: { descendants: (f: (n: { type: { name: string }; nodeSize: number }, p: number) => void) => void }; tr: { delete: (a: number, b: number) => unknown } }
      view: { dispatch: (t: unknown) => void }
    }
    const spots: { pos: number; size: number }[] = []
    ed.state.doc.descendants((n, p) => { if (n.type.name === 'image') spots.push({ pos: p, size: n.nodeSize }) })
    const it = spots[2]
    ed.view.dispatch(ed.state.tr.delete(it.pos, it.pos + it.size))
  })

  /* 죽은 참조는 「[참조 없음]」 이 되고, 뒤 참조들만 한 칸씩 당겨진다 */
  await expect(async () => {
    expect(await xref.allInnerTexts()).toEqual(['그림 1', '그림 2', '[참조 없음]', '그림 3', '그림 4'])
  }).toPass({ timeout: 8000 })

  /* 그러고는 멎는다 — 지우기 한 번과 참조 고침 한 번이면 끝이다 */
  const 잰것 = await 셈
  expect(잰것.돈횟수).toBeLessThanOrEqual(6)
  expect(잰것.마지막).toBeLessThan(3000)
})
