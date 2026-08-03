import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * 되돌리기는 글을 잃지 않는다.
 *
 * 붙박이 강의 노트를 열고 그냥 타자를 친 뒤 Ctrl+Z 를 잇달아 누르면 문서가 무너졌다.
 * 실측: 4,288자 → (한 번은 멀쩡) → 8,004 → 15,436 → 30,300 → 60,028, 쪽 9 → 17 → 23 → 84.
 * 되돌릴수록 같은 글이 두 벌씩 불어났다.
 *
 * 세 가지가 겹쳐 있었다.
 *
 *  하나. 쪽 나눔이 넘치는 블록을 「지우고 다음 쪽에 다시 넣어」 옮겼다.
 *        ProseMirror 의 이력은 이력에 담지 않는 트랜잭션이라도 **그 매핑은 담아** 두었다가
 *        저장해 둔 되돌리기 걸음을 그 위에 다시 앉힌다. 그런데 지우고 다시 넣기는 매핑에서
 *        옮김이 아니다 — 지운 범위 안을 가리키던 자리는 지운 지점으로 접혀 어디로 갔는지 잃는다.
 *        뒤집힌 걸음의 두 끝 중 한쪽만 접히면 「지울 곳」 을 잃고 「넣을 것」 만 남아 문서가 불어난다.
 *        이력에 쌓여 있던 매핑 열여덟 개가 모두 「크게 지우고 크게 넣기」 짝이었다.
 *        → 이제 글을 옮기지 않고 **쪽 경계만 옮긴다** (잇고 다시 가르기).
 *
 *  둘.  문서를 「연」 것이 되돌리기 한 걸음으로 쌓였다. 그래서 두 번째 Ctrl+Z 는
 *        **열기 전 문서**(대개 빈 새 메모)를 도로 불러왔다. 워드·한글은 파일을 열면 목록을 비운다.
 *
 *  셋.  다시 할 것이 없을 때 Ctrl+Shift+Z 가 **되돌리기**로 둔갑했다. ProseMirror 의 키 처리기가
 *        「글자 키 + Shift」 로 짝을 못 찾으면 Shift 를 뗀 이름으로 한 번 더 찾기 때문이다.
 *        다시 하려던 사람이 방금 쓴 글을 잃는다.
 *
 * 여기서 재는 잣대는 하나다: **되돌린 자리의 저장본이 그때 그 저장본과 한 글자도 다르지 않은가.**
 * (글자수만 보면 같은 수의 글이 뒤바뀐 것을 놓친다.)
 */

const JAN = path.join(process.cwd(), 'e2e', 'fixtures', 'lecture.jan')

type Page = import('@playwright/test').Page

interface 잰값 {
  글자: number
  /** 빈칸까지 그대로 센 길이 — 빈칸 하나가 지워진 것도 놓치지 않는다 */
  날글자: number
  쪽: number
  저장본: string
  /** 저장본에 남은 표·행의 수 — 쪽 경계에서 나뉜 조각은 저장할 때 한 표로 합쳐진다 */
  저장표수: number
  저장행수: number
  되돌림: number
  다시: number
}

/** 편집기의 지금 형편 — 저장본은 앱의 진짜 저장 경로(getSavableHtml)로 뽑는다 */
async function 재기(page: Page): Promise<잰값> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __janEditor: {
        state: { doc: { textContent: string }; plugins: Array<{ key: string; getState: (s: unknown) => unknown }> }
        view: { dom: HTMLElement }
      }
      __janSavable: () => string
    }
    const ed = w.__janEditor
    const hist = ed.state.plugins.find((p) => String(p.key).startsWith('history$'))
    const hs = hist
      ? (hist.getState(ed.state) as { done: { eventCount: number }; undone: { eventCount: number } })
      : null
    const saved = w.__janSavable()
    const 뿌리 = new DOMParser().parseFromString(`<div id="r">${saved}</div>`, 'text/html').getElementById('r')!
    return {
      글자: ed.state.doc.textContent.replace(/\s+/g, '').length,
      날글자: ed.state.doc.textContent.length,
      쪽: ed.view.dom.querySelectorAll('[data-jan-page]').length,
      저장본: saved,
      저장표수: 뿌리.querySelectorAll('table').length,
      저장행수: 뿌리.querySelectorAll('tr').length,
      되돌림: hs ? hs.done.eventCount : -1,
      다시: hs ? hs.undone.eventCount : -1,
    }
  })
}

/** 쪽 나눔이 앉을 때까지 기다린다 (쪽마다 블록 수·높이가 잇달아 같아질 때까지) */
async function 가라앉기(page: Page, 최대 = 70) {
  const 모습 = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.jan-page-node')]
        .map((p) => `${p.children.length}:${Math.round((p as HTMLElement).getBoundingClientRect().height)}`)
        .join(',')
    )
  let 앞 = ''
  let 같음 = 0
  for (let i = 0; i < 최대; i += 1) {
    await page.waitForTimeout(150)
    const 지금 = await 모습()
    같음 = 지금 === 앞 && 지금 !== '' ? 같음 + 1 : 0
    앞 = 지금
    if (같음 >= 3) return
  }
}

/** 어느 쪽도 글이 아래 여백을 뚫지 않았는가 (늘어나도 되는 쪽은 예외) */
async function 넘친양(page: Page): Promise<number> {
  return page.evaluate(() => {
    let worst = 0
    document.querySelectorAll('[data-jan-page]').forEach((pg) => {
      if (pg.getAttribute('data-jan-grow') === '1') return
      const box = pg.getBoundingClientRect()
      const limit = box.bottom - (parseFloat(getComputedStyle(pg).paddingBottom) || 0)
      pg.childNodes.forEach((n) => {
        if (n.nodeType !== 1) return
        const el = n as HTMLElement
        if (el.classList.contains('ProseMirror-widget')) return
        if (getComputedStyle(el).position === 'absolute') return
        const r = el.getBoundingClientRect()
        if (r.height && r.bottom > limit) worst = Math.max(worst, r.bottom - limit)
      })
    })
    return Math.round(worst)
  })
}

/** 빈 새 메모에서 시작한다 */
async function 새메모(page: Page) {
  await page.goto('./')
  await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 20000 })
  const model = await page.evaluate(
    () => document.querySelector('[data-page-model]')?.getAttribute('data-page-model') ?? ''
  )
  test.skip(model !== 'nodes', `독립 페이지 모델이 아님 (${model})`)
  await page.getByRole('button', { name: '새 메모', exact: true }).first().click()
  await page.locator('.jan-page-node').first().click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await page.waitForTimeout(600)
}

/** 사람이 붙여넣은 것처럼 밀어 넣는다 (되돌리기 한 걸음으로 쌓인다) */
async function 붙여넣기(page: Page, html: string) {
  await page.evaluate((h) => {
    const pm = document.querySelector('.ProseMirror') as HTMLElement
    pm.focus()
    const dt = new DataTransfer()
    dt.setData('text/html', h)
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, html)
  await 가라앉기(page)
}

/** 붙박이 강의 노트를 앱의 진짜 「열기」 길로 연다 (그림 5장 · 9쪽) */
async function 강의노트(page: Page) {
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
  await 가라앉기(page, 90)
}

const 긴문단 = (i: number) =>
  `<p>문단 ${i}. ` + '쪽을 채우기 위한 긴 문장입니다. 가나다라마바사아자차카타파하 ABCDEFG. '.repeat(9) + '</p>'

test.describe('되돌리기는 글을 잃지 않는다', () => {
  test('그림이 든 강의 노트 — 타자 뒤 Ctrl+Z 를 여섯 번 눌러도 연 그대로다', async ({ page }) => {
    test.setTimeout(180000)
    await 강의노트(page)
    const 연직후 = await 재기(page)
    expect(연직후.글자).toBeGreaterThan(3000)
    expect(연직후.쪽).toBeGreaterThan(3)
    /* 여는 것은 고치는 것이 아니다 — 되돌릴 것이 하나도 없어야 한다.
       (이것이 쌓여 있던 시절, 두 번째 Ctrl+Z 가 열기 전 문서를 도로 불러왔다) */
    expect(연직후.되돌림).toBe(0)

    /* 본문 문단에 친다 — 문서 끝은 목차 필드라 스스로 다시 쓰이므로 친 글이 지워진다
       (Control+End 로 쳤더니 저장본에 남지 않았다. 시험이 헛돌던 자리다) */
    await page.locator('.ProseMirror p:not([data-jan-field])').filter({ hasText: '강의 녹취를' }).first().click()
    await page.keyboard.type('가나다라마')
    await 가라앉기(page)
    const 탄뒤 = await 재기(page)
    /* 잣대는 저장본이다. 화면의 글자수는 쪽 나눔이 얹은 「반복 제목 행」 을 함께 세므로
       조판이 앉는 사이에도 흔들린다 — 저장본은 그 조각을 도로 합쳐 흔들리지 않는다. */
    expect(탄뒤.저장본).not.toBe(연직후.저장본)
    expect(탄뒤.저장본).toContain('가나다라마')

    for (let i = 1; i <= 6; i += 1) {
      await page.keyboard.press('Control+z')
      await 가라앉기(page)
      const m = await 재기(page)
      // 한 번 되돌린 뒤로는 더 되돌릴 것이 없다 — 여섯 번을 눌러도 연 그대로여야 한다
      expect(m.저장본, `${i}번째 되돌리기에서 문서가 달라졌다 (${m.글자}자 · ${m.쪽}쪽)`).toBe(연직후.저장본)
    }
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)

    // 다시 하기도 한 번만 먹고, 그 뒤로는 아무 일도 일어나지 않는다
    for (let i = 1; i <= 6; i += 1) {
      await page.keyboard.press('Control+Shift+z')
      await 가라앉기(page)
      const m = await 재기(page)
      expect(m.저장본, `${i}번째 다시하기에서 문서가 달라졌다`).toBe(탄뒤.저장본)
    }
  })

  test('쪽을 건너 밀리는 고침을 세 번 하고 하나씩 되돌리면 매번 그때 그 자리다', async ({ page }) => {
    test.setTimeout(240000)
    await 새메모(page)
    await 붙여넣기(page, Array.from({ length: 22 }, (_, i) => 긴문단(i + 1)).join(''))

    const 자취: 잰값[] = [await 재기(page)]
    expect(자취[0].쪽).toBeGreaterThan(2) // 여러 쪽이라야 쪽 나눔이 글을 옮긴다

    /* 문서 맨 앞에 여러 문단짜리 덩이를 붙여넣는다 — 넣은 그 덩이 자체가 쪽을 넘어 흩어진다.
       되돌리려면 「넣은 자리부터 넣은 만큼」 을 지워야 하는데, 그 사이를 쪽 나눔이
       지우고 다시 넣어 옮겨 버리면 지울 끝을 잃는다. 여기가 무너지던 자리다. */
    for (const 말 of ['첫고침', '둘고침', '셋고침']) {
      await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
      await page.keyboard.press('Control+Home')
      await 붙여넣기(page, Array.from({ length: 6 }, (_, i) => `<p>${말} ${i + 1}. ` +
        '끼워 넣은 문단이며 쪽을 넘길 만큼 길다. 가나다라마바사아자차카타파하. '.repeat(6) + '</p>').join(''))
      자취.push(await 재기(page))
    }
    expect(자취[3].쪽).toBeGreaterThan(자취[0].쪽) // 정말 쪽이 늘 만큼 넣었다

    for (let i = 1; i <= 3; i += 1) {
      await page.keyboard.press('Control+z')
      await 가라앉기(page, 120)
      const m = await 재기(page)
      expect(m.저장본, `${i}번째 되돌리기가 그때 그 문서로 돌아가지 않았다 (${m.글자}자 · ${m.쪽}쪽)`)
        .toBe(자취[3 - i].저장본)
    }
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)

    // 다시 하기로 끝까지 올라가면 마지막 자리로 정확히 돌아온다
    for (let i = 1; i <= 3; i += 1) {
      await page.keyboard.press('Control+y')
      await 가라앉기(page, 120)
      const m = await 재기(page)
      expect(m.저장본, `${i}번째 다시하기가 그때 그 문서로 돌아가지 않았다 (${m.글자}자 · ${m.쪽}쪽)`)
        .toBe(자취[i].저장본)
    }
  })

  test('스무 번을 연달아 눌러 이력이 바닥나도 문서가 온전하다', async ({ page }) => {
    test.setTimeout(240000)
    await 새메모(page)
    await 붙여넣기(page, Array.from({ length: 18 }, (_, i) => 긴문단(i + 1)).join(''))
    const 바탕 = await 재기(page)

    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+Home')
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.type(`덧글${i} `.repeat(20))
      await 가라앉기(page)
    }
    const 고친뒤 = await 재기(page)

    for (let i = 1; i <= 20; i += 1) await page.keyboard.press('Control+z')
    await 가라앉기(page, 120)
    const 바닥 = await 재기(page)
    expect(바닥.되돌림).toBe(0)                       // 정말 바닥까지 갔다
    expect(바닥.저장본).toBe('<p></p>')               // 붙여넣기까지 되돌아간 빈 문서
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)

    // 스무 번을 더 눌러도 더는 아무 일도 없다
    for (let i = 1; i <= 20; i += 1) await page.keyboard.press('Control+z')
    await 가라앉기(page, 120)
    expect((await 재기(page)).저장본).toBe('<p></p>')

    // 다시 하기로 끝까지 올라가면 고치고 난 그 문서가 한 글자도 다르지 않게 돌아온다
    for (let i = 1; i <= 20; i += 1) await page.keyboard.press('Control+y')
    await 가라앉기(page, 120)
    const 되찾음 = await 재기(page)
    expect(되찾음.글자).toBeGreaterThan(바탕.글자)
    expect(되찾음.저장본).toBe(고친뒤.저장본)
  })

  test('쪽 경계에서 백스페이스로 이어 붙인 뒤 되돌리면 그 자리로 돌아온다', async ({ page }) => {
    test.setTimeout(180000)
    await 새메모(page)
    /* 한 쪽보다 긴 문단은 쪽 경계에서 줄 단위로 쪼개진다 —
       그 조각 맨 앞의 백스페이스는 PageBoundaryKeymap 이 직접 처리한다 */
    await 붙여넣기(page, `<p>${'가나다라마바사아자차카타파하 이것은 한 쪽보다 긴 문단이며 반드시 쪽 경계에서 쪼개진다. '.repeat(60)}</p>`)
    expect(await page.locator('.ProseMirror [data-jan-cont]').count()).toBeGreaterThan(0)
    const 앞 = await 재기(page)

    // 이어짐 조각의 맨 앞으로 가서 백스페이스 (쪽 경계를 넘는 편집)
    await page.evaluate(() => {
      const ed = (window as unknown as {
        __janEditor: {
          state: { doc: { descendants: (f: (n: { attrs?: Record<string, unknown> }, pos: number) => void) => void } }
          commands: { focus: () => boolean; setTextSelection: (p: number) => boolean }
        }
      }).__janEditor
      let at = -1
      ed.state.doc.descendants((node, pos) => { if (at < 0 && node.attrs?.janCont) at = pos + 1 })
      ed.commands.focus()
      ed.commands.setTextSelection(at)
    })
    await page.keyboard.press('Backspace')
    await 가라앉기(page)
    const 지운뒤 = await 재기(page)
    // 워드처럼 글자 하나만 지워진다 (문단이 갈라지지도, 글이 뭉텅이로 사라지지도 않는다)
    expect(지운뒤.날글자).toBe(앞.날글자 - 1)

    await page.keyboard.press('Control+z')
    await 가라앉기(page)
    const 되돌린뒤 = await 재기(page)
    expect(되돌린뒤.저장본).toBe(앞.저장본)
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)

    await page.keyboard.press('Control+y')
    await 가라앉기(page)
    expect((await 재기(page)).저장본).toBe(지운뒤.저장본)
  })

  test('표·수식이 든 문서에서도 되돌리기가 글을 잃지 않는다', async ({ page }) => {
    test.setTimeout(240000)
    await 새메모(page)
    const 행 = (i: number) => `<tr><td><p>행 ${i}</p></td><td><p>값 ${i}</p></td></tr>`
    const 수식 = '<p>보기: <span data-jan-math="1" data-latex="E = mc^2">E = mc^2</span> 끝.</p>'
    await 붙여넣기(page,
      Array.from({ length: 8 }, (_, i) => 긴문단(i + 1)).join('') +
      수식 +
      '<table><tbody>' + Array.from({ length: 30 }, (_, i) => 행(i + 1)).join('') + '</tbody></table>' +
      Array.from({ length: 8 }, (_, i) => 긴문단(i + 20)).join('')
    )
    const 바탕 = await 재기(page)
    expect(바탕.쪽).toBeGreaterThan(2)
    // 표가 정말 쪽 경계에 걸려 나뉘었는가 (안 걸리면 이 시험은 헛것이다)
    expect(await page.locator('.ProseMirror table').count()).toBeGreaterThan(1)

    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('앞머리 덧글 '.repeat(30))
    await 가라앉기(page)
    const 고친뒤 = await 재기(page)

    await page.keyboard.press('Control+z')
    await 가라앉기(page)
    const 되돌린뒤 = await 재기(page)
    expect(되돌린뒤.저장본).toBe(바탕.저장본)
    for (let i = 1; i <= 30; i += 1) expect(되돌린뒤.저장본).toContain(`행 ${i}`)
    expect(되돌린뒤.저장본).toContain('E = mc^2')

    await page.keyboard.press('Control+y')
    await 가라앉기(page)
    expect((await 재기(page)).저장본).toBe(고친뒤.저장본)
  })

  test('쪽에 걸쳐 나뉜 표 — 칸에 친 글을 되돌려도 표가 온전하다', async ({ page }) => {
    /* 표 나눔은 문단 옮기기보다 문서를 크게 뒤집는다. 예전에는 표를 통째로 지우고 앞·뒤 두
       표를 새로 넣어서, **표 안의 모든 자리가 매핑에서 사라졌다.** 그래서 칸에 글을 치고
       그 표가 쪽을 넘어가면 그 타자를 되돌릴 수 없었다 —
       실측: 1,206자 → (48자 침) 1,254 → Ctrl+Z 두 번을 눌러도 1,229 에서 멎었다. */
    test.setTimeout(240000)
    await 새메모(page)
    const 행 = (i: number) => `<tr><td><p>행 ${i}</p></td><td><p>값 ${i}</p></td></tr>`
    await 붙여넣기(page,
      긴문단(1) + 긴문단(2) +
      '<table><tbody>' + Array.from({ length: 40 }, (_, i) => 행(i + 1)).join('') + '</tbody></table>' +
      긴문단(3))
    const 바탕 = await 재기(page)
    expect(바탕.쪽).toBeGreaterThan(1)
    expect(await page.locator('.ProseMirror table').count()).toBeGreaterThan(1) // 정말 나뉘었다
    expect(바탕.저장표수).toBe(1)   // 저장하면 한 표로 돌아온다
    expect(바탕.저장행수).toBe(40)

    // 표 첫 조각의 칸에 커서를 두고 타자 — 표가 커지며 쪽 나눔이 다시 돈다
    await page.locator('.ProseMirror table td').nth(6).click({ force: true })
    await page.keyboard.type('칸에친글 '.repeat(12))
    await 가라앉기(page)
    const 친뒤 = await 재기(page)
    expect(친뒤.글자).toBeGreaterThan(바탕.글자)

    /* 친 만큼만 되돌린다 (붙여넣기까지 가면 빈 문서가 되는 것이 옳다) */
    for (let i = 0; i < 12 && (await 재기(page)).되돌림 > 바탕.되돌림; i += 1) {
      await page.keyboard.press('Control+z')
      await 가라앉기(page)
    }
    const 되돌린뒤 = await 재기(page)
    expect(되돌린뒤.저장본).toBe(바탕.저장본)
    expect(되돌린뒤.저장표수).toBe(1)   // 되돌린 뒤에도 저장본은 한 표
    expect(되돌린뒤.저장행수).toBe(40)  // 행을 하나도 잃지 않았다
    for (let i = 1; i <= 40; i += 1) expect(되돌린뒤.저장본).toContain(`행 ${i}`)
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)
  })

  test('칸 안에 표가 든 문서 — 되돌린 뒤에도 안쪽 표가 온전하다', async ({ page }) => {
    test.setTimeout(240000)
    await 새메모(page)
    await 붙여넣기(page,
      '<p>표 앞</p><table><tbody>' +
      '<tr><td><p>바깥 1</p></td><td><p>값 1</p></td></tr>' +
      '<tr><td><table><tbody>' +
      Array.from({ length: 60 }, (_, i) => `<tr><td><p>안 ${i + 1}</p></td><td><p>속값 ${i + 1}</p></td></tr>`).join('') +
      '</tbody></table></td><td><p>값 2</p></td></tr>' +
      '<tr><td><p>바깥 3</p></td><td><p>값 3</p></td></tr>' +
      '</tbody></table><p>표 뒤</p>')
    const 바탕 = await 재기(page)
    expect(바탕.쪽).toBeGreaterThan(1)
    expect(await page.locator('.ProseMirror table').count()).toBeGreaterThan(2) // 바깥도 안쪽도 나뉘었다

    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('앞머리 덧글 '.repeat(20))
    await 가라앉기(page)
    const 친뒤 = await 재기(page)

    for (let i = 0; i < 12 && (await 재기(page)).되돌림 > 바탕.되돌림; i += 1) {
      await page.keyboard.press('Control+z')
      await 가라앉기(page)
    }
    const 되돌린뒤 = await 재기(page)
    expect(되돌린뒤.저장본).toBe(바탕.저장본)
    for (let i = 1; i <= 60; i += 1) expect(되돌린뒤.저장본).toContain(`안 ${i}`)
    expect(되돌린뒤.저장본).toContain('바깥 3')
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)

    await page.keyboard.press('Control+y')
    await 가라앉기(page)
    expect((await 재기(page)).저장본).toBe(친뒤.저장본)
  })

  /**
   * 아직 못 지키는 것 — 칸 **속** 표의 칸에 친 글은 되돌릴 수 없다.
   *
   * 바깥 표 한 행이 한 쪽보다 길면 그 행을 두 행으로 가르는 「깊이 나눔」 이 돈다
   * (tableSplit.ts 의 splitTableDeepAcrossPages). 그 걸음은 바깥 표를 통째로 지우고
   * 새 표 둘을 넣으므로 표 안의 자리가 매핑에서 모두 사라진다 — 우리가 쪽 경계·표 나눔에서
   * 없앤 바로 그 고장이 거기 하나 남아 있다.
   * 실측: 안쪽 칸에 50자를 치고 Ctrl+Z 를 세 번 눌러도 468자 → 438자에서 멎고 「속칸에친글」 이 남았다.
   *
   * 고치려면 tableSplit.ts 를 쪼개기(split) 걸음으로 바꿔야 하는데 그 파일은 지금 다른 손이
   * 쥐고 있다. 그래서 여기서는 **떨어질 것을 알고 두는 시험**으로 남긴다 —
   * 고쳐지면 이 시험이 「떨어져야 하는데 통과했다」 고 알려 준다.
   */
  test('[아직 못 지킴] 칸 속 표의 칸에 친 글도 되돌릴 수 있어야 한다', async ({ page }) => {
    test.fail()
    test.setTimeout(240000)
    await 새메모(page)
    await 붙여넣기(page,
      '<p>표 앞</p><table><tbody>' +
      '<tr><td><p>바깥 1</p></td><td><p>값 1</p></td></tr>' +
      '<tr><td><table><tbody>' +
      Array.from({ length: 60 }, (_, i) => `<tr><td><p>안 ${i + 1}</p></td><td><p>속값 ${i + 1}</p></td></tr>`).join('') +
      '</tbody></table></td><td><p>값 2</p></td></tr>' +
      '<tr><td><p>바깥 3</p></td><td><p>값 3</p></td></tr>' +
      '</tbody></table><p>표 뒤</p>')
    const 바탕 = await 재기(page)
    expect(await page.locator('.ProseMirror table table').count()).toBeGreaterThan(1) // 안쪽 표가 정말 나뉘었다

    await page.locator('.ProseMirror table table td').nth(4).click({ force: true })
    await page.keyboard.type('속칸에친글 '.repeat(10))
    await 가라앉기(page)

    for (let i = 0; i < 10 && (await 재기(page)).되돌림 > 바탕.되돌림; i += 1) {
      await page.keyboard.press('Control+z')
      await 가라앉기(page)
    }
    const 되돌린뒤 = await 재기(page)
    expect(되돌린뒤.저장본).not.toContain('속칸에친글')
    expect(되돌린뒤.저장본).toBe(바탕.저장본)
  })

  test('되돌린 뒤 저장했다 다시 열어도 글이 그대로다', async ({ page }) => {
    test.setTimeout(240000)
    await 새메모(page)
    await 붙여넣기(page, Array.from({ length: 20 }, (_, i) => 긴문단(i + 1)).join(''))
    const 바탕 = await 재기(page)

    await page.evaluate(() => (document.querySelector('.ProseMirror') as HTMLElement).focus())
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('되돌릴 덧글 '.repeat(30))
    await 가라앉기(page)
    await page.keyboard.press('Control+z')
    await 가라앉기(page)
    expect((await 재기(page)).저장본).toBe(바탕.저장본)

    /* 저장본을 그대로 다시 싣는다 — 저장했다 다시 연 것과 같은 길이다
       (앱은 이 평면 HTML 을 메모에 넣고, 열 때 그것을 setContent 로 되싣는다) */
    const 저장본 = (await 재기(page)).저장본
    await page.evaluate((html) => {
      const ed = (window as unknown as { __janEditor: { commands: { setContent: (h: string) => boolean } } }).__janEditor
      ed.commands.setContent(html)
    }, 저장본)
    await 가라앉기(page, 120)

    const 다시연뒤 = await 재기(page)
    expect(다시연뒤.저장본).toBe(바탕.저장본)
    expect(다시연뒤.글자).toBe(바탕.글자)
    expect(await 넘친양(page)).toBeLessThanOrEqual(2)
  })
})
