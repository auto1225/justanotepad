import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  findStyle, newStyle, propOrigin, resolveStyle, styleTree, wouldCycle,
} from '../lib/docStyles'
import type { NamedStyle, StyleProps } from '../lib/docStyles'
import { useUIStore } from '../store/uiStore'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/** 커서가 앉은 문단·글자에 붙은 표를 읽는다 */
function styleAtCursor(editor: Editor | null): { para: string | null; char: string | null } {
  if (!editor) return { para: null, char: null }
  const para = (editor.getAttributes('paragraph').janStyle as string | null)
    ?? (editor.getAttributes('heading').janStyle as string | null)
    ?? null
  const char = (editor.getAttributes('janCharStyle').id as string | null) ?? null
  return { para, char }
}

const FONT_CHOICES: Array<{ v: string; label: string }> = [
  { v: '', label: '(물려받음)' },
  { v: 'sans', label: '고딕' },
  { v: 'serif', label: '명조' },
  { v: 'mono', label: '고정폭' },
]

const ALIGN_CHOICES: Array<{ v: string; label: string }> = [
  { v: '', label: '(물려받음)' },
  { v: 'left', label: '왼쪽' },
  { v: 'center', label: '가운데' },
  { v: 'right', label: '오른쪽' },
  { v: 'justify', label: '양쪽' },
]

/* 개요 수준 — 워드 「단락 → 개요 수준」. 목차와 개요 패널이 읽는 문서의 뼈대다 */
const OUTLINE_CHOICES: Array<{ v: string; label: string }> = [
  { v: '', label: '(물려받음)' },
  { v: '0', label: '본문' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ v: String(n), label: `수준 ${n}` })),
]

/**
 * 스타일 창 — 워드 「스타일」 창 · 한글 「스타일 마당」 자리.
 *
 * 왼쪽에 어떤 스타일이 있고 무엇을 물려받는지 대를 이어 늘어놓고,
 * 그 하나를 아래에서 고친다. 여기서 고친 값은 문서를 건드리지 않는다 —
 * 그런데도 그 표를 단 글이 모두 함께 바뀐다. 그게 이 창의 요점이다.
 *
 * 칸마다 「↑ 부모이름」 이 뜨면 그 값은 제 것이 아니라 기준 스타일에서 내려온 것이다.
 * 값을 넣으면 제 것이 되고, 「물려받기」 를 누르면 도로 부모를 따른다.
 */
export function StylePanel({ editor, onClose }: Props) {
  const sheet = useUIStore((s) => s.styles)
  const setStyleSheet = useUIStore((s) => s.setStyleSheet)
  const updateStyle = useUIStore((s) => s.updateStyle)
  const [pick, setPick] = useState<string>('base')
  const [cursor, setCursor] = useState(() => styleAtCursor(editor))

  const tree = useMemo(() => styleTree(sheet), [sheet])
  const chosen = findStyle(sheet, pick)
  const resolved = chosen ? resolveStyle(sheet, chosen.id) : {}

  useEffect(() => {
    if (!editor) return
    const sync = () => setCursor(styleAtCursor(editor))
    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => { editor.off('selectionUpdate', sync); editor.off('transaction', sync) }
  }, [editor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const setProp = <K extends keyof StyleProps>(key: K, value: StyleProps[K] | undefined) => {
    if (!chosen) return
    updateStyle(chosen.id, { props: { [key]: value } as Partial<StyleProps> })
  }

  const apply = () => {
    if (!editor || !chosen) return
    if (chosen.kind === 'character') {
      if (editor.state.selection.empty) { flash('글자 스타일은 글을 고른 뒤에 입힌다'); return }
      editor.chain().focus().setCharStyle(chosen.id).run()
    } else {
      editor.chain().focus().setParagraphStyle(chosen.id).run()
    }
    flash(`「${chosen.name}」 을 입혔습니다`)
  }

  const clearHere = () => {
    if (!editor) return
    editor.chain().focus().setParagraphStyle(null).unsetCharStyle().run()
    flash('스타일 표를 뗐습니다')
  }

  const addStyle = () => {
    const s = newStyle(sheet, `${chosen?.name || '바탕글'} 사본`, chosen?.id ?? null, chosen?.kind || 'paragraph')
    setStyleSheet({ styles: [...sheet.styles, s] })
    setPick(s.id)
  }

  const removeStyle = () => {
    if (!chosen || chosen.builtin) return
    /* 지워진 스타일을 부모로 삼던 것들은 할아버지에게 붙인다 — 붕 뜨면 서식이 통째로 사라진다 */
    setStyleSheet({
      styles: sheet.styles
        .filter((s) => s.id !== chosen.id)
        .map((s) => (s.basedOn === chosen.id ? { ...s, basedOn: chosen.basedOn } : s)),
    })
    setPick(chosen.basedOn || 'base')
  }

  /**
   * 칸 하나 — 이름줄과 다루개를 따로 둔다.
   *
   * 「물려받기」 단추를 <label> 안에 넣었더니 그 단추의 접근 이름이 단추 글이 아니라
   * title 로 잡혔다 (라벨 안의 글은 그 라벨이 가리키는 입력칸의 이름으로 먹힌다).
   * 화면 읽개가 엉뚱하게 읽고, 이름으로 단추를 찾을 수도 없다. 그래서 라벨을 쓰지 않는다.
   */
  const field = (label: string, key: keyof StyleProps, control: ReactNode) => {
    const own = chosen?.props[key] !== undefined
    const origin = !own && chosen ? propOrigin(sheet, chosen.id, key) : null
    return (
      <div className="jan-stylepanel-field" key={key}>
        <div className="jan-stylepanel-fieldhead">
          <span>{label}</span>
          {origin && origin.id !== chosen?.id && (
            <button
              type="button" className="jan-stylepanel-from"
              aria-label={`${label} — 「${origin.name}」 에서 물려받음`}
              title={`「${origin.name}」 에서 물려받은 값입니다`}
              onClick={() => setPick(origin.id)}
            >↑ {origin.name}</button>
          )}
          {own && (
            <button
              type="button" className="jan-stylepanel-reset"
              aria-label={`${label} 물려받기`}
              title="이 값을 버리고 기준 스타일을 따른다"
              onClick={() => setProp(key, undefined)}
            >물려받기</button>
          )}
        </div>
        {control}
      </div>
    )
  }

  const numberField = (label: string, key: keyof StyleProps, min: number, max: number, step?: number) =>
    field(label, key, (
      <input
        type="number" min={min} max={max} step={step} aria-label={`스타일 ${label}`}
        value={(chosen?.props[key] as number | undefined) ?? (resolved[key] as number | undefined) ?? ''}
        placeholder="물려받음"
        onChange={(e) => setProp(key, (e.target.value === '' ? undefined : Number(e.target.value)) as never)}
      />
    ))

  const parentChoices = sheet.styles.filter(
    (s) => chosen && s.id !== chosen.id && s.kind === chosen.kind && !wouldCycle(sheet, chosen.id, s.id)
  )

  /* 창을 덮지 않는다 — 워드의 스타일 창처럼 옆에 떠 있고 문서는 그대로 만질 수 있다.
     덮개(overlay)로 두었더니 「선택한 곳에 적용」 을 쓰려고 커서를 옮기는 순간 창이 닫혔다. */
  return (
    <div className="jan-stylepanel" role="dialog" aria-label="스타일">
      <div className="jan-stylepanel-head">
        <h3>스타일</h3>
        <button className="jan-modal-close" onClick={onClose} aria-label="닫기">닫기</button>
      </div>

      <div className="jan-stylepanel-cursor">
        커서 자리:{' '}
        <strong>{findStyle(sheet, cursor.para)?.name || '(스타일 없음)'}</strong>
        {cursor.char && <> · 글자 <strong>{findStyle(sheet, cursor.char)?.name}</strong></>}
      </div>

      <div className="jan-stylepanel-body">
        <div className="jan-stylepanel-list" role="listbox" aria-label="스타일 목록">
          {tree.map(({ style, depth }) => (
            <button
              key={style.id}
              role="option"
              aria-selected={pick === style.id}
              className={pick === style.id ? 'is-active' : ''}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => setPick(style.id)}
            >
              <strong>
                {depth > 0 && <span className="jan-stylepanel-branch">└ </span>}
                {style.name}
                {style.kind === 'character' && <em> (글자)</em>}
              </strong>
              <span>
                {style.basedOn
                  ? `기준: ${findStyle(sheet, style.basedOn)?.name || '?'}`
                  : '기준 없음 (뿌리)'}
                {cursor.para === style.id ? ' · 커서 자리' : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="jan-stylepanel-form">
          {!chosen ? <p>스타일을 고르세요.</p> : (
            <>
              <div className="jan-stylepanel-actions">
                <button type="button" onClick={apply}>선택한 곳에 적용</button>
                <button type="button" onClick={addStyle}>새 스타일 (이것을 기준으로)</button>
                <button type="button" onClick={removeStyle} disabled={chosen.builtin}>지우기</button>
                <button type="button" onClick={clearHere}>커서 자리 표 떼기</button>
              </div>

              <div className="jan-stylepanel-field">
                <div className="jan-stylepanel-fieldhead"><span>이름</span></div>
                <input
                  aria-label="스타일 이름"
                  value={chosen.name}
                  onChange={(e) => updateStyle(chosen.id, { name: e.target.value })}
                />
              </div>

              <div className="jan-stylepanel-field">
                <div className="jan-stylepanel-fieldhead"><span>기준 스타일</span></div>
                <select
                  aria-label="기준 스타일"
                  value={chosen.basedOn || ''}
                  onChange={(e) => updateStyle(chosen.id, { basedOn: e.target.value || null })}
                >
                  <option value="">(없음 — 뿌리)</option>
                  {parentChoices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="jan-stylepanel-grid">
                {field('글꼴', 'fontFamily', (
                  <select
                    aria-label="스타일 글꼴"
                    value={chosen.props.fontFamily || ''}
                    onChange={(e) => setProp('fontFamily', e.target.value || undefined)}
                  >
                    {FONT_CHOICES.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                ))}
                {numberField('글자 크기', 'fontSize', 4, 200)}
                {field('글자 색', 'color', (
                  <input
                    type="color" aria-label="스타일 글자 색"
                    value={chosen.props.color ?? resolved.color ?? '#191919'}
                    onChange={(e) => setProp('color', e.target.value)}
                  />
                ))}
                {numberField('줄 간격', 'lineHeight', 0.5, 5, 0.05)}
              </div>

              <div className="jan-stylepanel-toggles">
                {([['bold', '굵게'], ['italic', '기울임'], ['underline', '밑줄']] as const).map(([key, label]) => (
                  <span key={key} className="jan-stylepanel-toggle">
                    <button
                      type="button"
                      aria-label={`스타일 ${label}`}
                      aria-pressed={!!resolved[key]}
                      className={resolved[key] ? 'is-active' : ''}
                      onClick={() => setProp(key, !resolved[key])}
                    >{label}</button>
                    {chosen.props[key] !== undefined && (
                      <button
                        type="button" className="jan-stylepanel-reset"
                        aria-label={`${label} 물려받기`}
                        title="이 값을 버리고 기준 스타일을 따른다"
                        onClick={() => setProp(key, undefined)}
                      >물려받기</button>
                    )}
                  </span>
                ))}
              </div>

              {chosen.kind === 'paragraph' && (
                <div className="jan-stylepanel-grid">
                  {numberField('문단 앞 공백', 'spaceBefore', 0, 400)}
                  {numberField('문단 뒤 공백', 'spaceAfter', 0, 400)}
                  {numberField('들여쓰기', 'indent', 0, 800)}
                  {field('정렬', 'align', (
                    <select
                      aria-label="스타일 정렬"
                      value={chosen.props.align || ''}
                      onChange={(e) => setProp('align', (e.target.value || undefined) as StyleProps['align'])}
                    >
                      {ALIGN_CHOICES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
                    </select>
                  ))}
                  {/* 눈에 보이는 값이 아니다 — 목차와 개요 패널이 읽는 문서의 뼈대다 */}
                  {field('개요 수준', 'outlineLevel', (
                    <select
                      aria-label="스타일 개요 수준"
                      value={chosen.props.outlineLevel === undefined ? '' : String(chosen.props.outlineLevel)}
                      onChange={(e) => setProp('outlineLevel', e.target.value === '' ? undefined : Number(e.target.value))}
                    >
                      {OUTLINE_CHOICES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  ))}
                </div>
              )}

              <StylePreview style={chosen} resolved={resolved} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** 고른 스타일이 실제로 어떻게 보이는지 — 물려받은 값까지 합친 결과 */
function StylePreview({ style, resolved }: { style: NamedStyle; resolved: StyleProps }) {
  const summary = [
    resolved.fontFamily && `글꼴 ${resolved.fontFamily}`,
    resolved.fontSize && `${resolved.fontSize}pt`,
    resolved.bold && '굵게',
    resolved.italic && '기울임',
    resolved.underline && '밑줄',
    resolved.lineHeight && `줄 ${resolved.lineHeight}`,
    resolved.indent !== undefined && `들여 ${resolved.indent}px`,
    style.kind === 'paragraph' && resolved.outlineLevel !== undefined &&
      (resolved.outlineLevel === 0 ? '개요: 본문' : `개요 수준 ${resolved.outlineLevel}`),
  ].filter(Boolean).join(' · ')
  const attr = style.kind === 'character' ? { 'data-jan-cstyle': style.id } : { 'data-jan-style': style.id }
  return (
    <div className="jan-stylepanel-preview">
      <p {...attr}>다람쥐 헌 쳇바퀴에 타고파. The quick brown fox 123</p>
      <small>{summary || '스스로 정한 것도 물려받은 것도 없습니다 (문서 기본 서식 그대로)'}</small>
    </div>
  )
}
