import { Extension } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { flash } from '../lib/flash'
import {
  clearCrop, copyImageFormat, cropSide, currentImage, fitImageToBody, flipImage, moveImage,
  nudgeImage, pasteImageFormat, resetImageFormat, resetImageSize, resizeImage, rotateImage,
  selectImage, selectNextImage, setImageWrap, toggleAspectLock, toggleImageLock,
} from '../lib/imageWord'
import {
  currentShape, cycleTextDirection, cycleVAlign, flipShape, moveShape, nudgeShape, resizeShape,
  rotateShape, selectNextShape, setShapeWrap, toggleShapeLock,
} from '../lib/shapeWord'

/**
 * 개체 키보드 조작 — 마우스 없이도 그림과 그리기 개체를 다 다룬다.
 *
 * 표에서 정한 규칙을 그대로 따른다: 수식어는 **하나만**(Alt).
 * 워드가 쓰는 Shift+방향키(크기)는 브라우저와 부딪히지 않아 그대로 살렸고,
 * 워드의 Ctrl+방향키(미세 이동)는 웹에서 글자 단위 이동과 겹쳐 Alt 로 옮겼다.
 *
 * 그림이 골라져 있지 않으면 아무것도 가로채지 않는다.
 */
export const ImageKeymap = Extension.create({
  name: 'janImageKeymap',

  addKeyboardShortcuts() {
    const editor = this.editor
    /** 그림이 「골라진」 상태여야만 듣는다 — 글 쓰는 중에 끼어들지 않게 */
    const pickedType = () => {
      const sel = editor.state.selection
      return sel instanceof NodeSelection ? sel.node.type.name : ''
    }
    const inTable = () => editor.isActive('table')
    const picked = () => pickedType() === 'image' && !inTable()
    const pickedShape = () => pickedType() === 'janShape'
    const near = () => currentImage(editor) != null
    const nearShape = () => currentShape(editor) != null
    /** 그림이면 첫 번째, 그리기 개체면 두 번째 일을 한다 */
    const both = (img: () => boolean, shape: () => boolean) => () => {
      if (picked()) return img()
      if (pickedShape()) return shape()
      return false
    }
    const bothNear = (img: () => boolean, shape: () => boolean) => () => {
      if (near()) return img()
      if (nearShape()) return shape()
      return false
    }
    const on = (fn: () => boolean) => () => (picked() ? fn() : false)
    const onNear = (fn: () => boolean) => () => (near() ? fn() : false)
    const onShape = (fn: () => boolean) => () => (nearShape() ? fn() : false)

    const WRAPS = ['topbottom', 'inline', 'left', 'right', 'behind', 'front']
    const WRAP_NAMES: Record<string, string> = {
      topbottom: '위/아래', inline: '글자처럼 취급', left: '왼쪽에 두고 감싸기',
      right: '오른쪽에 두고 감싸기', behind: '텍스트 뒤', front: '텍스트 앞',
    }
    const cycleWrap = (dir: 1 | -1) => {
      const hit = currentImage(editor) || currentShape(editor)
      if (!hit) return false
      const cur = (hit.node.attrs.wrap as string) || 'topbottom'
      const next = WRAPS[(WRAPS.indexOf(cur) + dir + WRAPS.length) % WRAPS.length]
      const note = `배치: ${WRAP_NAMES[next]}`
      return hit.node.type.name === 'image' ? setImageWrap(editor, next, note) : setShapeWrap(editor, next, note)
    }

    /**
     * 그림을 고른 채 Enter — 워드는 고른 그림이 사라지고 그 자리에 새 문단이 선다.
     *
     * ProseMirror 의 기본(createParagraphNear)은 그림을 **남기고** 그 아래에 문단을
     * 하나 더 만든다. 재어 보니 그림 1개·문단 23→24개로, 글자를 쳤을 때
     * (그림이 지워지고 그 자리에 글자가 들어감)와도 어긋났다.
     */
    const enterOnImage = () => {
      const { state, view } = editor
      const sel = state.selection
      if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return false
      const para = state.schema.nodes.paragraph
      if (!para) return false
      const tr = state.tr.replaceSelectionWith(para.create(), false)
      /* 새 문단 안에 글자 자리를 놓는다 — 워드처럼 바로 이어서 칠 수 있게 */
      const inside = Math.min(sel.from + 1, tr.doc.content.size)
      tr.setSelection(TextSelection.near(tr.doc.resolve(inside)))
      view.dispatch(tr.scrollIntoView())
      return true
    }

    const ask = (name: string) => {
      window.dispatchEvent(new CustomEvent('jan-image-dialog', { detail: { tab: name } }))
      return true
    }

    const helpFlash = () => {
      flash(
        '개체 단축키 — Shift+방향키 크기 · Alt+방향키 이동 · Alt+Shift+방향키 자르기(Alt+X 되돌리기) · ' +
        'Alt+R 회전(Shift 반대) · Alt+H/V 좌우·상하 대칭 · Alt+W 배치 · Alt+0 원래 크기 · Alt+F 본문 너비 · ' +
        'Alt+K 비율 고정 · Alt+L 개체 보호 · Alt+B 서식 복사(Shift 붙이기) · Alt+Z 서식 지우기 · ' +
        'Alt+P 속성 · Alt+C 캡션 · Alt+A 대체 텍스트 · Alt+T 색 보정 · Alt+N 다음 그림 · Alt+S 다음 도형 · ' +
        'Alt+D 글자 방향(도형) · Shift+F10 메뉴',
        9000
      )
      return true
    }

    return {
      /* ── 크기: Shift + 방향키 (워드·파워포인트와 같은 자리) ── */
      'Shift-ArrowRight': both(() => resizeImage(editor, 12), () => resizeShape(editor, 12, 0)),
      'Shift-ArrowLeft': both(() => resizeImage(editor, -12), () => resizeShape(editor, -12, 0)),
      'Shift-ArrowDown': both(() => resizeImage(editor, 0, 12), () => resizeShape(editor, 0, 12)),
      'Shift-ArrowUp': both(() => resizeImage(editor, 0, -12), () => resizeShape(editor, 0, -12)),

      /* ── 미세 이동: Alt + 방향키 ── */
      'Alt-ArrowRight': both(() => nudgeImage(editor, 1, 0), () => nudgeShape(editor, 1, 0)),
      'Alt-ArrowLeft': both(() => nudgeImage(editor, -1, 0), () => nudgeShape(editor, -1, 0)),
      'Alt-ArrowDown': both(() => nudgeImage(editor, 0, 1), () => nudgeShape(editor, 0, 1)),
      'Alt-ArrowUp': both(() => nudgeImage(editor, 0, -1), () => nudgeShape(editor, 0, -1)),

      /* ── 자르기: Alt+Shift + 방향키 (그쪽 변을 더 잘라 낸다) ── */
      'Alt-Shift-ArrowRight': on(() => cropSide(editor, 'r', 0.02)),
      'Alt-Shift-ArrowLeft': on(() => cropSide(editor, 'l', 0.02)),
      'Alt-Shift-ArrowDown': on(() => cropSide(editor, 'b', 0.02)),
      'Alt-Shift-ArrowUp': on(() => cropSide(editor, 't', 0.02)),
      'Alt-x': on(() => clearCrop(editor)),

      /* ── 고르기·옮겨 다니기 ── */
      'Alt-g': onNear(() => selectImage(editor)),
      Tab: both(() => selectNextImage(editor, 1), () => selectNextShape(editor, 1)),
      'Shift-Tab': both(() => selectNextImage(editor, -1), () => selectNextShape(editor, -1)),
      'Alt-n': () => selectNextImage(editor, 1),
      'Alt-N': () => selectNextImage(editor, -1),
      /* 표 안에서는 Alt+S 가 「칸 하나 고르기」 다 — 표 밖에서만 도형을 고른다 */
      'Alt-s': () => (editor.isActive('table') ? false : selectNextShape(editor, 1)),
      'Alt-S': () => (editor.isActive('table') ? false : selectNextShape(editor, -1)),

      /* ── 문서 안에서 자리 옮기기 ── */
      'Alt-Home': both(() => moveImage(editor, -1), () => moveShape(editor, -1)),
      'Alt-End': both(() => moveImage(editor, 1), () => moveShape(editor, 1)),

      /* ── 돌리기·뒤집기 ── */
      'Alt-r': bothNear(() => rotateImage(editor, 90), () => rotateShape(editor, 90)),
      'Alt-R': bothNear(() => rotateImage(editor, -90), () => rotateShape(editor, -90)),
      'Alt-h': bothNear(() => flipImage(editor, 'h'), () => flipShape(editor, 'h')),
      'Alt-v': bothNear(() => flipImage(editor, 'v'), () => flipShape(editor, 'v')),

      /* ── 배치 ── */
      'Alt-w': bothNear(() => cycleWrap(1), () => cycleWrap(1)),
      'Alt-W': bothNear(() => cycleWrap(-1), () => cycleWrap(-1)),

      /* ── 크기 되돌리기·맞추기 ── */
      'Alt-0': onNear(() => resetImageSize(editor)),
      'Alt-f': onNear(() => fitImageToBody(editor)),
      'Alt-k': onNear(() => toggleAspectLock(editor)),
      'Alt-l': bothNear(() => toggleImageLock(editor), () => toggleShapeLock(editor)),
      /* 그리기 개체 전용 — 글자 방향(세로쓰기)과 세로 맞춤 */
      'Alt-d': onShape(() => cycleTextDirection(editor)),
      'Alt-D': onShape(() => cycleVAlign(editor)),

      /* ── 서식 ── */
      'Alt-z': onNear(() => resetImageFormat(editor)),
      'Alt-b': onNear(() => copyImageFormat(editor)),
      'Alt-B': onNear(() => pasteImageFormat(editor)),

      /* ── 대화상자 (여기서 나머지 모든 값을 숫자로 정한다) ── */
      'Alt-p': bothNear(() => ask('size'), () => { window.dispatchEvent(new CustomEvent('jan-shape-dialog', { detail: { mode: 'format' } })); return true }),
      'Alt-c': onNear(() => ask('caption')),
      'Alt-a': onNear(() => ask('alt')),
      'Alt-t': onNear(() => ask('adjust')),

      /* ── 고른 그림 위에서 Enter — 워드처럼 그림이 사라지고 새 문단이 선다 ── */
      Enter: enterOnImage,

      /* ── 무엇을 쓸 수 있는지 ── */
      'Alt-/': bothNear(helpFlash, helpFlash),
    }
  },
})
