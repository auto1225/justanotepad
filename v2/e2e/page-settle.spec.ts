import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * 쪽 나눔은 반드시 멎어야 한다.
 *
 * 그림이 든 강의 노트에서 끝없이 돌고 있었다. 사람이 아무것도 안 하는 6초 동안 문서를
 * 295번 고쳐 쓰고 <img> 요소를 1,486번 새로 만들었다. 쪽 수는 그대로라 눈에 띄지 않는다.
 *
 * 두 가지가 맞물려 있었다.
 *  하나. 밀기와 당기기가 서로 다른 잣대로 재서 두 모양을 오갔다 —
 *        쪽별 블록이 [7,8,8,19,…] ↔ [7,8,10,17,…] 로 초당 쉰 번씩.
 *  둘.  쪽을 다시 짜면 그림 요소가 새로 만들어지고, 새 요소가 「다 왔다」(load)를 또 낸다.
 *        그 소식이 다시 쪽 나눔을 불러, 횟수 제한도 맴돌기 감지도 처음으로 되돌렸다.
 *
 * 그동안 그림 노드가 매 프레임 갈아치워져 그림을 붙잡을 수도, 손잡이를 끌 수도 없었다 —
 * 「크기 조절이 안 된다」 가 이것이다.
 *
 * 붙박이는 실제로 맴돌던 그 강의 노트다. 그림 알맹이만 같은 크기의 단색으로 갈아 끼웠다
 * (맴돌기는 글 흐름과 블록 높이에서 나므로 그림이 무엇인지는 상관없다).
 * 쪽 설정(A4 · 여백 20mm · 줄지 배경)까지 그대로여야 재현된다.
 */

const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

test('그림이 여럿인 문서를 열어도 쪽 나눔이 멎는다', async ({ page }) => {
  const bytes = readFileSync(JAN).toString('base64')

  await page.goto('./')
  await page.evaluate(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  /* 파일 고르기 창은 자동화가 못 연다 — 고른 셈 치고 그 뒤 길을 그대로 태운다 */
  await page.addInitScript((b64: string) => {
    ;(window as unknown as Record<string, unknown>).showOpenFilePicker = async () => {
      const bin = atob(b64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
      const file = new File([buf], '강의 노트.jan')
      return [{ kind: 'file', name: file.name, getFile: async () => file }]
    }
  }, bytes)
  await page.reload()
  const doc = page.locator('.ProseMirror').first()
  await doc.waitFor({ state: 'visible' })

  await page.locator('.jan-ribbon-tab', { hasText: /^파일$/ }).first().click()
  await page.locator('.jan-ribbon-body button[aria-label*="열기"]').first().click()
  await expect(doc.locator('img')).toHaveCount(5, { timeout: 30000 })
  await page.waitForTimeout(12000) // 앉을 틈을 넉넉히 준다

  /* 이제 아무도 건드리지 않는다 — 그런데도 문서가 계속 바뀌면 맴도는 것이다 */
  const seen = await page.evaluate(async () => {
    const editor = (window as unknown as {
      __janEditor: {
        on: (e: string, f: (p: unknown) => void) => void
        off: (e: string, f: (p: unknown) => void) => void
        view: { dom: HTMLElement }
      }
    }).__janEditor
    let 문서변경 = 0
    const onTx = (p: unknown) => {
      if ((p as { transaction: { docChanged: boolean } }).transaction.docChanged) 문서변경 += 1
    }
    editor.on('transaction', onTx)
    let 그림새로 = 0
    const mo = new MutationObserver((rs) => {
      for (const r of rs) {
        for (const n of Array.from(r.addedNodes)) {
          if (n.nodeType !== 1) continue
          const el = n as Element
          if (el.tagName === 'IMG') 그림새로 += 1
          그림새로 += el.querySelectorAll?.('img').length || 0
        }
      }
    })
    mo.observe(editor.view.dom, { subtree: true, childList: true })
    await new Promise((r) => setTimeout(r, 4000))
    mo.disconnect()
    editor.off('transaction', onTx)
    return { 문서변경, 그림새로, 쪽: editor.view.dom.querySelectorAll('[data-jan-page]').length }
  })

  expect(seen.쪽).toBeGreaterThan(3) // 여러 쪽에 걸쳐 있다
  expect(seen.문서변경).toBeLessThan(5) // 맴돌면 4초에 200번을 넘는다
  expect(seen.그림새로).toBeLessThan(15) // 맴돌면 천 번을 넘는다
})
