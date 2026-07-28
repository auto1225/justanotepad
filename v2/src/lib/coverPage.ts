import type { Editor } from '@tiptap/react'
import { flash } from './flash'

/**
 * 표지와 빈 쪽 — 워드 「삽입 › 표지 · 빈 페이지」.
 *
 * 표지는 문서 맨 앞에 새 쪽으로 들어가고, 뒤 내용은 다음 쪽으로 밀린다.
 * 워드처럼 제목·부제·글쓴이·날짜 자리를 갖춘 본을 골라 쓴다.
 */

export interface CoverStyle {
  key: string
  label: string
  hint: string
  html: (v: { title: string; subtitle: string; author: string; date: string }) => string
}

const line = (text: string, css: string) => (text ? `<p style="${css}">${text}</p>` : '')

export const COVER_STYLES: CoverStyle[] = [
  {
    key: 'plain',
    label: '단정한 표지',
    hint: '가운데 정렬, 제목이 크고 아래에 글쓴이',
    html: (v) =>
      '<p style="text-align:center;margin-top:180px"></p>' +
      line(v.title, 'text-align:center;font-size:34px;font-weight:700;letter-spacing:-0.5px;margin-bottom:8px') +
      line(v.subtitle, 'text-align:center;font-size:17px;color:#5b6270;margin-bottom:64px') +
      line(v.author, 'text-align:center;font-size:15px;margin-bottom:4px') +
      line(v.date, 'text-align:center;font-size:14px;color:#5b6270'),
  },
  {
    key: 'line',
    label: '선이 있는 표지',
    hint: '제목 위아래로 가로줄',
    html: (v) =>
      '<p style="text-align:center;margin-top:200px"></p>' +
      '<hr data-variant="solid" />' +
      line(v.title, 'text-align:center;font-size:30px;font-weight:700;margin:20px 0') +
      '<hr data-variant="solid" />' +
      line(v.subtitle, 'text-align:center;font-size:16px;color:#5b6270;margin-top:16px') +
      '<p style="text-align:center;margin-top:120px">' +
      [v.author, v.date].filter(Boolean).join(' · ') +
      '</p>',
  },
  {
    key: 'left',
    label: '왼쪽 정렬 표지',
    hint: '보고서에 어울리는 왼쪽 맞춤',
    html: (v) =>
      '<p style="margin-top:220px"></p>' +
      line(v.title, 'font-size:36px;font-weight:800;line-height:1.2;margin-bottom:10px') +
      line(v.subtitle, 'font-size:18px;color:#5b6270;margin-bottom:80px') +
      '<hr data-variant="solid" />' +
      line(v.author, 'font-size:15px;margin-top:14px') +
      line(v.date, 'font-size:14px;color:#5b6270'),
  },
  {
    key: 'paper',
    label: '논문 표지',
    hint: '학회 제출용 — 제목·소속·초록 자리',
    html: (v) =>
      line(v.title, 'text-align:center;font-size:26px;font-weight:700;margin-top:120px;margin-bottom:18px') +
      line(v.author, 'text-align:center;font-size:15px;margin-bottom:4px') +
      line(v.subtitle, 'text-align:center;font-size:14px;color:#5b6270;margin-bottom:40px') +
      '<p style="text-align:center;font-weight:600;margin-bottom:8px">초록</p>' +
      '<p style="text-align:justify;text-indent:1em">여기에 초록을 쓴다.</p>' +
      line(v.date, 'text-align:center;font-size:13px;color:#5b6270;margin-top:60px'),
  },
]

/** 표지를 문서 맨 앞에 넣는다 (뒤 내용은 다음 쪽으로) */
export function insertCover(
  editor: Editor | null,
  style: string,
  values: { title: string; subtitle: string; author: string; date: string }
): boolean {
  if (!editor) return false
  const def = COVER_STYLES.find((c) => c.key === style) || COVER_STYLES[0]
  const html = def.html(values) + '<hr data-page-break="1" />'
  const ok = editor.chain().focus().setTextSelection(1).insertContentAt(0, html).run()
  if (ok) flash(`${def.label}를 맨 앞에 넣었다`)
  return ok
}

/** 빈 쪽 — 커서 자리에 쪽 나눔 둘을 넣어 한 쪽을 비운다 (워드와 같다) */
export function insertBlankPage(editor: Editor | null): boolean {
  if (!editor) return false
  const ok = editor.chain().focus()
    .insertContent('<hr data-page-break="1" /><p></p><hr data-page-break="1" />')
    .run()
  if (ok) flash('빈 쪽을 넣었다')
  return ok
}

/** 오늘 날짜 — 표지 기본값 */
export function todayLabel(): string {
  const now = new Date()
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`
}
