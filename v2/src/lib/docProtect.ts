import type { EditorState, Transaction } from '@tiptap/pm/state'
import { flash } from './flash'

/**
 * 편집 제한 — 워드 「검토 › 편집 제한」과 「작성자 차단」.
 *
 * 다 만든 문서를 남에게 돌릴 때 「읽기만」·「메모만」·「고치면 표시가 남게」 처럼
 * 손댈 수 있는 범위를 좁혀 둔다. 워드의 작성자 차단은 같이 쓰는 문서에서
 * 남의 자리를 못 건드리게 하는 것이라, 우리는 「남이 손댄 자리 잠그기」 로 옮겼다.
 *
 * 자물쇠는 예절 수준이다 — 정말로 내용을 감춰야 한다면 「잠금(암호화)」 을 쓴다.
 * 암호는 그대로 두지 않고 지문(SHA-256)만 남긴다.
 */

export type ProtectMode = 'off' | 'read' | 'comment' | 'track' | 'fields'

export interface Protect {
  mode: ProtectMode
  /** 남이 넣은 글·메모가 있는 자리를 잠근다 */
  blockOthers: boolean
  /** 풀 때 물어볼 암호의 지문 (빈 값이면 그냥 풀 수 있다) */
  pin: string
}

export const PROTECT_MODES: { key: ProtectMode; label: string; hint: string }[] = [
  { key: 'off', label: '제한 없음', hint: '누구든 마음대로 고친다' },
  { key: 'read', label: '읽기만', hint: '글자 하나도 못 바꾼다 — 돌려 볼 때' },
  { key: 'comment', label: '메모만 달기', hint: '본문은 그대로 두고 의견만 남긴다' },
  { key: 'track', label: '고치면 표시 남기기', hint: '추적을 켠 채로만 고칠 수 있다' },
  { key: 'fields', label: '누름틀만 채우기', hint: '서식은 잠그고 빈칸만 채운다' },
]

const KEY = 'jan-v2-protect'
const OFF: Protect = { mode: 'off', blockOthers: false, pin: '' }

let active: Protect = { ...OFF }
let activeMemo = ''

function storeKey(memoId: string) {
  return `${KEY}:${memoId}`
}

function read(memoId: string): Protect {
  try {
    const raw = localStorage.getItem(storeKey(memoId))
    if (!raw) return { ...OFF }
    const p = JSON.parse(raw) as Partial<Protect>
    const mode = PROTECT_MODES.some((m) => m.key === p.mode) ? (p.mode as ProtectMode) : 'off'
    return { mode, blockOthers: !!p.blockOthers, pin: typeof p.pin === 'string' ? p.pin : '' }
  } catch { return { ...OFF } }
}

/** 메모를 열 때마다 그 메모에 걸린 제한을 살려 둔다 */
export function activateProtect(memoId: string): Protect {
  activeMemo = memoId || ''
  active = activeMemo ? read(activeMemo) : { ...OFF }
  document.documentElement.dataset.janProtect = active.mode
  return active
}

export function currentProtect(): Protect {
  return active
}

export function saveProtect(next: Partial<Protect>): Protect {
  active = { ...active, ...next }
  document.documentElement.dataset.janProtect = active.mode
  try {
    if (activeMemo) {
      if (active.mode === 'off' && !active.blockOthers) localStorage.removeItem(storeKey(activeMemo))
      else localStorage.setItem(storeKey(activeMemo), JSON.stringify(active))
    }
  } catch { /* 저장 못 해도 이번 판은 걸린다 */ }
  window.dispatchEvent(new Event('jan-protect-changed'))
  return active
}

/** 암호 지문 — 원문은 어디에도 남기지 않는다 */
export async function pinPrint(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function pinMatches(text: string): Promise<boolean> {
  if (!active.pin) return true
  return (await pinPrint(text)) === active.pin
}

/* ── 막기 ────────────────────────────────────────────── */

let lastGrumble = 0
function grumble(msg: string) {
  const now = performance.now()
  if (now - lastGrumble < 1500) return
  lastGrumble = now
  flash(msg)
}

/**
 * 표시만 붙이고 글은 건드리지 않는 변경인가.
 * 클래스 이름으로 가리면 빌드에서 이름이 줄어 못 알아본다 — 단계의 JSON 이름을 본다.
 */
function marksOnly(tr: Transaction, markName?: string): boolean {
  return tr.steps.every((step) => {
    const json = step.toJSON() as { stepType?: string; mark?: { type?: string } }
    if (json.stepType !== 'addMark' && json.stepType !== 'removeMark') return false
    if (!markName) return true
    return json.mark?.type === markName
  })
}

/** 남이 손댄 자리를 건드리는 변경인가 */
function touchesOthers(tr: Transaction, state: EditorState, me: string): boolean {
  let hit = false
  tr.steps.forEach((step) => {
    step.getMap().forEach((oldStart, oldEnd) => {
      if (hit || oldEnd <= oldStart) return
      const from = Math.max(0, Math.min(state.doc.content.size, oldStart))
      const to = Math.max(0, Math.min(state.doc.content.size, oldEnd))
      state.doc.nodesBetween(from, to, (node) => {
        if (hit || !node.isInline) return
        node.marks.forEach((m) => {
          if (m.type.name !== 'janIns' && m.type.name !== 'janComment') return
          const by = String(m.attrs.author || '')
          if (by && by !== me) hit = true
        })
      })
    })
  })
  return hit
}

/**
 * 이 변경을 받아들일까 — 편집기의 filterTransaction 이 물어 온다.
 * 우리 손으로 거는 변경(제한을 풀거나 메모를 지우는 일)은 janProtectAllow 표를 달아 지나간다.
 */
export function allowTransaction(tr: Transaction, state: EditorState, opts: { tracking: boolean; author: string }): boolean {
  const p = active
  if (p.mode === 'off' && !p.blockOthers) return true
  if (!tr.docChanged) return true
  if (tr.getMeta('janProtectAllow')) return true
  /* 추적기가 스스로 붙이는 표시는 막지 않는다 (막으면 표시 없이 글만 남는다) */
  if (tr.getMeta('janTrack')) return true
  /* 문서를 실어 오는 길(메모 바꿈·파일 열기)은 지나가야 한다 — 막으면 문서가 아예 안 열린다 */
  if (tr.getMeta('janTrackSkip')) return true
  /* 쪽 나누기·표 수식 다시 셈처럼 앱이 스스로 하는 손질은 되돌리기 기록에 남기지 않는다.
     그것을 표로 삼아 지나가게 한다 — 사람이 고치는 것만 막는 것이 이 자물쇠의 뜻이다. */
  if (tr.getMeta('addToHistory') === false) return true

  if (p.blockOthers && touchesOthers(tr, state, opts.author)) {
    grumble('남이 손댄 자리는 잠겨 있다 — 편집 제한에서 풀 수 있다')
    return false
  }

  switch (p.mode) {
    case 'read':
      grumble('읽기만 하도록 잠긴 문서다')
      return false
    case 'comment':
      if (marksOnly(tr, 'janComment')) return true
      grumble('메모만 달 수 있는 문서다')
      return false
    case 'fields':
      if (tr.getMeta('janAllow') === 'field') return true
      grumble('누름틀만 채울 수 있는 문서다')
      return false
    case 'track':
      if (opts.tracking) return true
      grumble('고치면 표시가 남아야 하는 문서다 — 추적을 켠다')
      return false
    default:
      return true
  }
}

/** 지금 걸린 제한을 한 줄로 (상태 줄·리본에 보여 준다) */
export function protectLine(p: Protect = active): string {
  const mode = PROTECT_MODES.find((m) => m.key === p.mode)
  const bits = [mode && mode.key !== 'off' ? mode.label : '']
  if (p.blockOthers) bits.push('남의 자리 잠금')
  const on = bits.filter(Boolean)
  return on.length ? on.join(' · ') : '제한 없음'
}
