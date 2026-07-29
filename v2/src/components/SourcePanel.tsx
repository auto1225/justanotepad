import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  CITE_STYLES, SOURCE_TYPES, citationText, citeStyle, loadSources, newSource,
  putBibliography, referenceText, saveSources, setCiteStyle,
} from '../lib/docRefs'
import type { CiteStyle, Source, SourceType } from '../lib/docRefs'
import { flash } from '../lib/flash'

interface Props {
  editor: Editor | null
  onClose: () => void
}

/**
 * 출처 관리 — 워드 「원본 관리자」 자리.
 * 왼쪽에 모아 둔 출처, 오른쪽에 그 하나의 항목들. 고른 출처는 본문에 인용으로 넣거나
 * 참고 문헌 목록으로 한꺼번에 넣는다. 표기 방식(APA·MLA·Chicago·IEEE·KCI)은 위에서 고른다.
 */
export function SourcePanel({ editor, onClose }: Props) {
  const [list, setList] = useState<Source[]>(() => loadSources())
  const [style, setStyle] = useState<CiteStyle>(() => citeStyle())
  const [pick, setPick] = useState<string>(() => loadSources()[0]?.id || '')
  const chosen = useMemo(() => list.find((s) => s.id === pick) || null, [list, pick])

  const commit = (next: Source[]) => { setList(next); saveSources(next) }
  const patch = (p: Partial<Source>) => {
    if (!chosen) return
    commit(list.map((s) => (s.id === chosen.id ? { ...s, ...p } : s)))
  }

  const add = () => {
    const s = newSource()
    commit([...list, s])
    setPick(s.id)
  }
  const remove = () => {
    if (!chosen) return
    const next = list.filter((s) => s.id !== chosen.id)
    commit(next)
    setPick(next[0]?.id || '')
  }

  const insertCite = () => {
    if (!editor || !chosen) return
    editor.chain().focus().insertContent(citationText(chosen, style)).run()
    flash('본문에 인용을 넣었습니다')
  }
  const insertBib = () => {
    if (!editor) return
    if (putBibliography(editor, list, style)) onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!editor) return null

  const field = (label: string, key: keyof Source, placeholder = '') => (
    <label className="jan-chartdlg-field">
      <span>{label}</span>
      <input
        value={String(chosen?.[key] ?? '')}
        placeholder={placeholder}
        aria-label={label}
        disabled={!chosen}
        onChange={(e) => patch({ [key]: e.target.value } as Partial<Source>)}
      />
    </label>
  )

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-srcdlg" role="dialog" aria-label="출처 관리" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>출처 관리</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>

        <div className="jan-design-row" style={{ padding: '8px 18px 0' }}>
          <span>표기 방식</span>
          <select
            value={style}
            aria-label="표기 방식"
            onChange={(e) => { const v = e.target.value as CiteStyle; setStyle(v); setCiteStyle(v) }}
          >
            {CITE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="jan-chartdlg-hint">본문 인용과 참고 문헌 모양이 함께 바뀐다</span>
        </div>

        <div className="jan-modal-body jan-srcdlg-body">
          <div className="jan-srcdlg-list" role="listbox" aria-label="모아 둔 출처">
            {list.length === 0 && <p className="jan-xrefdlg-empty">아직 출처가 없습니다. 「새 출처」 로 하나 넣어 보세요.</p>}
            {list.map((s) => (
              <button
                key={s.id}
                role="option"
                aria-selected={pick === s.id}
                className={pick === s.id ? 'is-active' : ''}
                onClick={() => setPick(s.id)}
              >
                <strong>{s.title || '(제목 없음)'}</strong>
                <span>{[s.authors, s.year].filter(Boolean).join(' · ') || '작성자·연도 미입력'}</span>
              </button>
            ))}
            <div className="jan-chartdlg-gridbtns">
              <button onClick={add}>새 출처</button>
              <button onClick={remove} disabled={!chosen}>지우기</button>
            </div>
          </div>

          <div className="jan-srcdlg-form">
            <label className="jan-chartdlg-field">
              <span>종류</span>
              <select
                value={chosen?.type || 'journal'}
                aria-label="출처 종류"
                disabled={!chosen}
                onChange={(e) => patch({ type: e.target.value as SourceType })}
              >
                {SOURCE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            {field('저자', 'authors', '홍길동, 김철수')}
            {field('제목', 'title', '스마트 주차 시스템의 설계')}
            {field('연도', 'year', '2026')}
            {field('실린 곳 (학술지·학회·사이트)', 'container', '한국정보과학회 논문지')}
            {field('발행처', 'publisher', '출판사·기관')}
            {field('권·호', 'volume', '12(3)')}
            {field('쪽', 'pages', '45-58')}
            {field('주소(URL)', 'url', 'https://')}

            {chosen && (
              <div className="jan-srcdlg-preview">
                <p><strong>본문 인용</strong> {citationText(chosen, style)}</p>
                <p><strong>참고 문헌</strong> {referenceText(chosen, style, 1)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="jan-modal-foot">
          <span className="jan-chartdlg-hint">출처는 이 브라우저에 모아 두고 여러 문서에서 함께 쓴다</span>
          <button onClick={insertCite} disabled={!chosen}>본문에 인용 넣기</button>
          <button className="jan-primary" onClick={insertBib}>참고 문헌 목록 넣기</button>
        </div>
      </div>
    </div>
  )
}
