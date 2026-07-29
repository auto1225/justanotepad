import { Extension } from '@tiptap/core'

/**
 * 한글·워드식 글자 모양 — 자간(letter-spacing)과 장평(글자 가로 비율).
 *
 * 둘 다 선택 영역에만 적용되도록 textStyle 마크의 속성으로 붙인다
 * (예전에는 문서 전체에 <style> 을 꽂아 넣어 한 문서 안에서 부분 적용이 불가능했다).
 *
 * 장평은 CSS 에 딱 맞는 속성이 없다. font-stretch 는 가변 글꼴에만 듣고,
 * 윈도우 한글 글꼴 대부분은 가변이 아니다. 그래서 한글(HWP)처럼 보이게
 * inline-block + scaleX 로 글자 폭만 줄이고, 줄바꿈은 안쪽에서 그대로 일어나게 둔다.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    janCharFormat: {
      /** 자간 — % 단위(한글 기준, -50~50). null 이면 해제 */
      setLetterSpacingPct: (pct: number | null) => ReturnType
      /** 장평 — % 단위(50~200). null 이면 해제 */
      setCharScalePct: (pct: number | null) => ReturnType
    }
  }
}

/** 자간 % → em (한글은 글자폭 기준 %, 웹은 em 이 가장 가깝다) */
export function letterSpacingEm(pct: number): string {
  return `${(pct / 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}em`
}

export const CharFormat = Extension.create({
  name: 'janCharFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.letterSpacing || null,
            renderHTML: (attrs: { letterSpacing?: string | null }) =>
              attrs.letterSpacing ? { style: `letter-spacing: ${attrs.letterSpacing}` } : {},
          },
          /* 문자 테두리 — 워드 「글꼴 › 문자 테두리」 */
          charBorder: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-char-border'),
            renderHTML: (attrs: { charBorder?: string | null }) =>
              attrs.charBorder
                ? { 'data-char-border': attrs.charBorder, style: `border: 1px solid ${attrs.charBorder}; padding: 0 2px; border-radius: 2px` }
                : {},
          },
          /* 문자 음영 — 워드 「글꼴 › 문자 음영」 */
          charShading: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-char-shading'),
            renderHTML: (attrs: { charShading?: string | null }) =>
              attrs.charShading
                ? { 'data-char-shading': attrs.charShading, style: `background-color: ${attrs.charShading}` }
                : {},
          },
          /* 밑줄 모양·색 — 워드는 밑줄 단추 옆 ▾ 에서 고른다 */
          underlineStyle: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-underline'),
            renderHTML: (attrs: { underlineStyle?: string | null; underlineColor?: string | null }) => {
              if (!attrs.underlineStyle) return {}
              const color = attrs.underlineColor ? ` ${attrs.underlineColor}` : ''
              return {
                'data-underline': attrs.underlineStyle,
                style: `text-decoration-line: underline; text-decoration-style: ${attrs.underlineStyle};` +
                  (attrs.underlineColor ? ` text-decoration-color: ${attrs.underlineColor};` : '') +
                  ` text-underline-offset: 2px;${color ? '' : ''}`,
              }
            },
          },
          underlineColor: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-underline-color'),
            renderHTML: (attrs: { underlineColor?: string | null }) =>
              attrs.underlineColor ? { 'data-underline-color': attrs.underlineColor } : {},
          },
          charScale: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const attr = el.getAttribute('data-char-scale')
              if (attr) return Number(attr) || null
              const m = /scaleX\(([\d.]+)\)/.exec(el.style.transform || '')
              return m ? Math.round(Number(m[1]) * 100) : null
            },
            renderHTML: (attrs: { charScale?: number | null }) => {
              const pct = attrs.charScale
              if (!pct || pct === 100) return {}
              return {
                'data-char-scale': String(pct),
                style: `display: inline-block; transform: scaleX(${pct / 100}); transform-origin: left center;`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLetterSpacingPct:
        (pct) =>
        ({ chain }) =>
          pct === null || pct === 0
            ? chain().setMark('textStyle', { letterSpacing: null }).removeEmptyTextStyle().run()
            : chain().setMark('textStyle', { letterSpacing: letterSpacingEm(pct) }).run(),

      setCharScalePct:
        (pct) =>
        ({ chain }) =>
          pct === null || pct === 100
            ? chain().setMark('textStyle', { charScale: null }).removeEmptyTextStyle().run()
            : chain().setMark('textStyle', { charScale: Math.round(pct) }).run(),
    }
  },
})
