import { test, expect } from '@playwright/test'

/**
 * 쪽 경계 바로 앞에서 한글을 조합하면 글자가 깨지는가.
 *
 * 조합 중인 글자는 **아직 문서에 앉지 않았다.** 「값」 을 치면 ㄱ·가·갑·값 넉 단계가
 * 한 글자 자리 위에서 갈아 끼워진다. 마침 그때 줄이 늘어 쪽 나눔이 돌면 ProseMirror 가
 * DOM 을 고쳐 쓰면서 조합이 끊기고, 끊긴 자리에서는 **그때까지의 조각이 진짜 글자로 굳는다.**
 *
 * 실측(고치기 전):
 *  · 글 문단 — A4 두 쪽, 첫 쪽 끝에서 값·곬·없 을 예순 자. 쉰째 글자에서 쪽 경계가
 *    움직였고(쪽별 블록 [17,9] → [17,10]) 바로 그 자리에 「곬」 의 첫 조각 ㄱ 이 한 글자로
 *    굳어 남았다 — 저장본이 **예순한 자**로 늘었다(…값곬없값**ㄱ**곬없값…).
 *  · 표 칸 — 쪽에 걸친 표의 마지막 행 첫 칸에서 아흔 자. 열아홉째 글자에서 행이 다음
 *    조각으로 넘어갔고(행 [8,16,6] → [7,1,14,2,6]) 같은 자리에 ㄱ 이 굳었다 — **아흔한 자**.
 *  두 경우 다 두 번 재어 두 번 다 같은 자리였다.
 *
 * 고친 뒤: 예순 자 / 아흔 자 그대로. 쪽 경계·행 넘어감은 **여전히 같은 글자에서 일어난다** —
 * 미루기만 하고 끝내면 조합으로만 채운 쪽이 영영 안 나뉘므로, 그것까지 함께 지킨다.
 *
 * Playwright 의 keyboard.type·insertText 는 조합을 흉내 내지 못한다(글자가 통째로 들어간다).
 * 진짜 조합은 CDP 의 Input.imeSetComposition 으로만 만들 수 있다.
 */

type Page = import('@playwright/test').Page
type CDP = import('@playwright/test').CDPSession

const 채움 = (i: number) =>
  `<p>${i}번 문단이다. 쪽을 채우기 위한 글이며 충분히 길어야 여러 줄이 된다. 가나다라마바사아자차카타파하 ABCDEFG HIJKLMN 오이시디에프지에이치.</p>`

/** 받침이 두 벌인 글자 — 조각이 굳으면 눈에 띄게 다른 글자가 남는다 */
const 글자 = [
  ['ㄱ', '가', '갑', '값'],
  ['ㄱ', '고', '골', '곬'],
  ['ㅇ', '어', '업', '없'],
] as const

async function 열기(page: Page, html: string) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
  await page.goto('./')
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(400)
  await page.evaluate((h) => {
    const w = window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }
    w.__janEditor.commands.setContent(h)
  }, html)
  await page.waitForTimeout(3000)
}

/** 글자 하나를 진짜 조합으로 친다 — 조각을 차례로 얹었다가 마지막에 굳힌다 */
async function 조합(cdp: CDP, page: Page, 단계: readonly string[]) {
  for (const t of 단계) {
    await cdp.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length })
    await page.waitForTimeout(45)
  }
  await cdp.send('Input.insertText', { text: 단계[단계.length - 1] })
  await page.waitForTimeout(70)
}

/** 저장본의 글 (쪽 래퍼·이어짐 조각을 되돌린 뒤의 진짜 문서) */
const 저장본 = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __janSavable: () => string }
    return new DOMParser().parseFromString(w.__janSavable(), 'text/html').body.textContent || ''
  })

/** 쪽별 블록 수 — 쪽 경계가 정말 움직였는지 보는 잣대 */
const 쪽별 = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __janEditor: { state: { doc: { forEach: (f: (n: { type: { name: string }; childCount: number }) => void) => void } } } }
    const out: number[] = []
    w.__janEditor.state.doc.forEach((p) => { if (p.type.name === 'page') out.push(p.childCount) })
    return out
  })

test('쪽 경계가 움직이는 그 글자에서도 조합이 깨지지 않는다', async ({ page }) => {
  test.setTimeout(180000)
  await 열기(page, Array.from({ length: 26 }, (_, i) => 채움(i + 1)).join(''))
  const cdp = await page.context().newCDPSession(page)

  // 첫 쪽의 마지막 글 자리 — 여기서 한 줄만 늘어도 쪽 경계가 움직인다
  await page.evaluate(() => {
    const w = window as unknown as {
      __janEditor: {
        state: { doc: { child: (i: number) => { nodeSize: number } } }
        commands: { focus: () => boolean; setTextSelection: (p: number) => boolean }
      }
    }
    w.__janEditor.commands.focus()
    w.__janEditor.commands.setTextSelection(w.__janEditor.state.doc.child(0).nodeSize - 2)
  })

  const 전글 = await 저장본(page)
  const 전쪽 = await 쪽별(page)
  expect(전쪽.length, '여러 쪽짜리가 아니면 이 시험은 아무것도 재지 못한다').toBeGreaterThan(1)

  let 친것 = ''
  let 갈렸나 = false
  for (let n = 0; n < 60; n++) {
    await 조합(cdp, page, 글자[n % 3])
    친것 += 글자[n % 3][3]
    if (!갈렸나 && JSON.stringify(await 쪽별(page)) !== JSON.stringify(전쪽)) 갈렸나 = true
  }
  await page.waitForTimeout(2500)
  const 후글 = await 저장본(page)

  // ① 친 그대로인가 — 조각이 굳어 남으면 길이가 늘고 통째로는 못 찾는다
  expect(후글.length - 전글.length, '저장본에 안 친 글자가 끼어들었다 (조합 조각이 굳었다)').toBe(친것.length)
  expect(후글.includes(친것), '친 글자들이 저장본에 이어져 있지 않다 — 사이에 무언가 끼었다').toBe(true)
  // ② 조합 중에 미뤘다고 쪽 나눔이 영영 안 도는 것은 아니어야 한다
  expect(갈렸나, '예순 자를 쳤는데 쪽 경계가 한 번도 안 움직였다 — 조판이 멎었다').toBe(true)
  // ③ 커서가 딴 데로 가지 않았는가
  const 커서앞 = await page.evaluate(() => {
    const w = window as unknown as { __janEditor: { state: { selection: { from: number }; doc: { textBetween: (a: number, b: number) => string } } } }
    const p = w.__janEditor.state.selection.from
    return w.__janEditor.state.doc.textBetween(Math.max(1, p - 3), p)
  })
  expect(커서앞, '커서가 방금 친 글 뒤에 없다').toBe(친것.slice(-3))
})

test('표 칸에서 행이 다음 쪽으로 넘어가는 그 글자에서도 조합이 깨지지 않는다', async ({ page }) => {
  test.setTimeout(180000)
  const 행 = (i: number) =>
    `<tr><td><p>${i}행이다. 쪽을 채우기 위한 글이며 넉넉히 길어야 한다. 가나다라마바사아자차카타파하 ABCDEFG.</p></td><td><p>둘째 칸 ${i}</p></td></tr>`
  await 열기(
    page,
    `${Array.from({ length: 8 }, (_, i) => 채움(i + 1)).join('')}<table><tbody>${Array.from({ length: 30 }, (_, i) => 행(i + 1)).join('')}</tbody></table>`,
  )
  const cdp = await page.context().newCDPSession(page)

  /** 표 조각별 행 수 — 행이 다음 조각으로 넘어갔는지 보는 잣대 */
  const 조각별행 = () =>
    page.evaluate(() => {
      const w = window as unknown as { __janEditor: { state: { doc: { descendants: (f: (n: { type: { name: string }; childCount: number }) => void) => void } } } }
      const out: number[] = []
      w.__janEditor.state.doc.descendants((n) => { if (n.type.name === 'table') out.push(n.childCount) })
      return out
    })

  // 쪽에 걸린 첫 표 조각의 **마지막 행 첫 칸** — 이미 여러 줄이라 한 줄만 늘어도 행이 자란다
  await page.evaluate(() => {
    const w = window as unknown as {
      __janEditor: {
        state: { doc: { descendants: (f: (n: { type: { name: string }; nodeSize: number }, p: number) => void) => void } }
        commands: { focus: () => boolean; setTextSelection: (p: number) => boolean }
      }
    }
    const 표: number[] = []
    w.__janEditor.state.doc.descendants((n, p) => { if (n.type.name === 'table') 표.push(p) })
    let 마지막행 = -1
    w.__janEditor.state.doc.descendants((n, p) => {
      if (n.type.name === 'tableRow' && p > (표[0] ?? 0) && p < (표[1] ?? Number.MAX_SAFE_INTEGER)) 마지막행 = p
    })
    let 끝 = -1
    w.__janEditor.state.doc.descendants((n, p) => {
      if (끝 < 0 && n.type.name === 'tableCell' && p > 마지막행) 끝 = p + n.nodeSize - 3
    })
    w.__janEditor.commands.focus()
    w.__janEditor.commands.setTextSelection(끝)
  })

  const 전글 = await 저장본(page)
  const 전행 = await 조각별행()
  expect(전행.length, '표가 쪽에 걸쳐 나뉘어 있지 않으면 이 시험은 아무것도 재지 못한다').toBeGreaterThan(1)

  let 친것 = ''
  let 넘어갔나 = false
  for (let n = 0; n < 90; n++) {
    await 조합(cdp, page, 글자[n % 3])
    친것 += 글자[n % 3][3]
    if (!넘어갔나 && JSON.stringify(await 조각별행()) !== JSON.stringify(전행)) 넘어갔나 = true
  }
  await page.waitForTimeout(2500)
  const 후글 = await 저장본(page)

  expect(후글.length - 전글.length, '저장본에 안 친 글자가 끼어들었다 (조합 조각이 굳었다)').toBe(친것.length)
  expect(후글.includes(친것), '친 글자들이 저장본에 이어져 있지 않다 — 사이에 무언가 끼었다').toBe(true)
  expect(넘어갔나, '아흔 자를 쳤는데 행이 한 번도 안 넘어갔다 — 조판이 멎었다').toBe(true)
})
