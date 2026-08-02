/**
 * 움직이는 그림 멈춰 두기.
 *
 * 문서 옆에서 계속 도는 그림은 눈을 끌어 글을 못 읽게 한다. 그렇다고 늘 멈춰 두면
 * 움직임으로 설명하는 그림(파면이 퍼져 쐐기가 서는 그림 같은 것)은 뜻을 잃는다.
 * 그래서 그림마다 사람이 고르게 하고, 여기서는 「멈춤」 을 실제로 그려 낸다.
 *
 * GIF 는 CSS 로 멈출 수 없다 (animation-play-state 는 CSS 애니메이션에만 듣는다).
 * 그래서 첫 장면을 화폭(canvas)에 떠서 그 그림을 대신 보여 준다.
 * 원본 주소는 data-anim-src 에 그대로 두므로, 다시 움직이게 할 때 되돌리면 된다 —
 * 문서에는 「멈춤」 이라는 표시 하나만 남고 떠낸 그림이 끼어들지 않는다.
 */

const ORIGIN_ATTR = 'data-anim-src'

/** 움직일 수 있는 그림인가 — 멈춤 단추를 보여 줄지 가리는 데 쓴다 */
export function isAnimated(src: string): boolean {
  const s = (src || '').toLowerCase()
  return s.includes('.gif') || s.startsWith('data:image/gif') || s.includes('.webp') || s.includes('.apng')
}

/** 첫 장면을 떠서 멈춘 그림으로 바꾼다 */
function freeze(img: HTMLImageElement): void {
  if (img.getAttribute(ORIGIN_ATTR)) return          // 이미 멈춰 있다
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return                                // 아직 안 왔다 — 오면 다시 부른다
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    img.setAttribute(ORIGIN_ATTR, img.src)
    img.src = canvas.toDataURL('image/png')
  } catch {
    /* 다른 곳에서 온 그림은 화폭이 더럽혀져 떠낼 수 없다 — 그냥 움직이게 둔다 */
  }
}

/** 멈춰 둔 그림을 다시 움직이게 한다 */
function unfreeze(img: HTMLImageElement): void {
  const origin = img.getAttribute(ORIGIN_ATTR)
  if (!origin) return
  img.removeAttribute(ORIGIN_ATTR)
  img.src = origin
}

/** 문서 안의 그림들을 data-still 표시대로 맞춘다 */
export function applyStill(root: ParentNode): void {
  root.querySelectorAll('img').forEach((el) => {
    const img = el as HTMLImageElement
    const want = img.closest('[data-still="1"]') !== null || img.getAttribute('data-still') === '1'
    if (want) {
      if (img.complete) freeze(img)
      else img.addEventListener('load', () => freeze(img), { once: true })
    } else {
      unfreeze(img)
    }
  })
}

/**
 * 문서가 바뀔 때마다 맞춰 준다.
 * 되돌려주는 것을 부르면 그만둔다.
 */
export function watchStill(root: HTMLElement): () => void {
  let timer: number | undefined
  const run = () => { timer = undefined; applyStill(root) }
  const schedule = () => { if (timer === undefined) timer = window.setTimeout(run, 60) }

  const mo = new MutationObserver(schedule)
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-still', 'src'] })
  applyStill(root)
  return () => {
    mo.disconnect()
    if (timer !== undefined) window.clearTimeout(timer)
  }
}
