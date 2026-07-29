import type { Editor } from '@tiptap/react'
import { flash } from './flash'
import { isTTSSupported, pauseTTS, resumeTTS, startTTSSession, cancelTTS, isTTSPaused } from './speech'
import type { TTSSessionHandle } from './speech'

/**
 * 소리내어 읽기 — 워드 「검토 › 소리내어 읽기」.
 *
 * 커서가 있는 문단부터 문서 끝까지 읽어 준다. 오래 쓴 글은 눈으로 보면 다 맞아
 * 보이는데 소리로 들으면 어색한 데가 드러난다 — 그래서 교정 묶음에 둔다.
 *
 * 읽는 동안 지금 읽는 문단에 자리 표시를 남긴다 (`.jan-reading`).
 */

let session: TTSSessionHandle | null = null
let marked: HTMLElement | null = null

function clearMark() {
  if (marked) marked.classList.remove('jan-reading')
  marked = null
}

function markBlock(editor: Editor, pos: number) {
  clearMark()
  try {
    const dom = editor.view.domAtPos(pos)?.node as HTMLElement | Text | null
    const el = (dom && (dom as HTMLElement).nodeType === 1 ? dom as HTMLElement : (dom as Text)?.parentElement) || null
    const block = el?.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th') as HTMLElement | null
    if (block) { block.classList.add('jan-reading'); marked = block }
  } catch { /* 자리를 못 찾으면 표시 없이 읽는다 */ }
}

export function isReading(): boolean {
  return !!session
}

/** 커서가 있는 자리부터 읽는다 (고른 글이 있으면 그 글만) */
export function readAloud(editor: Editor | null, opts: { rate?: number } = {}): boolean {
  if (!editor) return false
  if (!isTTSSupported()) { flash('이 브라우저는 소리내어 읽기를 못 한다'); return false }

  const { from, to, empty } = editor.state.selection
  const doc = editor.state.doc
  const start = empty ? doc.resolve(from).start(doc.resolve(from).depth) : from
  const end = empty ? doc.content.size : to
  const text = doc.textBetween(start, end, '\n', ' ').trim()
  if (!text) { flash('읽을 글이 없다'); return false }

  stopReading()
  markBlock(editor, start)
  session = startTTSSession({
    text,
    lang: 'ko-KR',
    rate: opts.rate ?? 1,
    onDone: () => { session = null; clearMark(); flash('다 읽었다') },
  })
  if (!session) { flash('소리내어 읽기를 시작하지 못했다'); clearMark(); return false }
  flash(empty ? '커서 자리부터 읽는다' : '고른 글을 읽는다')
  return true
}

export function pauseReading(): boolean {
  if (!session) { flash('읽고 있지 않다'); return false }
  if (isTTSPaused()) { resumeTTS(); flash('이어 읽는다'); return true }
  pauseTTS()
  flash('잠깐 멈췄다 — 다시 누르면 이어 읽는다')
  return true
}

export function stopReading(): boolean {
  if (session) session.cancel()
  else cancelTTS()
  session = null
  clearMark()
  return true
}

/** 다음 문단부터 다시 읽는다 (워드의 「다음」) */
export function readNextBlock(editor: Editor | null, dir: 1 | -1 = 1): boolean {
  if (!editor) return false
  const doc = editor.state.doc
  const here = editor.state.selection.from
  const spots: number[] = []
  doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent.trim()) spots.push(pos + 1)
  })
  if (!spots.length) return false
  const next = dir > 0
    ? spots.find((p) => p > here) ?? spots[0]
    : [...spots].reverse().find((p) => p < here) ?? spots[spots.length - 1]
  editor.chain().focus().setTextSelection(next).scrollIntoView().run()
  return readAloud(editor)
}
