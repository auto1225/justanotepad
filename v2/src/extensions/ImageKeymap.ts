import { Extension } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { flash } from '../lib/flash'
import {
  clearCrop, copyImageFormat, cropSide, currentImage, fitImageToBody, flipImage, moveImage,
  nudgeImage, pasteImageFormat, resetImageFormat, resetImageSize, resizeImage, rotateImage,
  selectImage, selectNextImage, setImageWrap, toggleAspectLock, toggleImageLock,
} from '../lib/imageWord'

/**
 * 그림 키보드 조작 — 마우스 없이도 그림을 다 다룬다.
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
    const picked = () => editor.state.selection instanceof NodeSelection
      && (editor.state.selection as NodeSelection).node.type.name === 'image'
    const near = () => currentImage(editor) != null
    const on = (fn: () => boolean) => () => (picked() ? fn() : false)
    const onNear = (fn: () => boolean) => () => (near() ? fn() : false)

    const WRAPS = ['topbottom', 'inline', 'left', 'right', 'behind', 'front']
    const WRAP_NAMES: Record<string, string> = {
      topbottom: '위/아래', inline: '글자처럼 취급', left: '왼쪽에 두고 감싸기',
      right: '오른쪽에 두고 감싸기', behind: '텍스트 뒤', front: '텍스트 앞',
    }
    const cycleWrap = (dir: 1 | -1) => {
      const hit = currentImage(editor)
      if (!hit) return false
      const cur = (hit.node.attrs.wrap as string) || 'topbottom'
      const next = WRAPS[(WRAPS.indexOf(cur) + dir + WRAPS.length) % WRAPS.length]
      return setImageWrap(editor, next, `배치: ${WRAP_NAMES[next]}`)
    }

    const ask = (name: string) => {
      window.dispatchEvent(new CustomEvent('jan-image-dialog', { detail: { tab: name } }))
      return true
    }

    return {
      /* ── 크기: Shift + 방향키 (워드·파워포인트와 같은 자리) ── */
      'Shift-ArrowRight': on(() => resizeImage(editor, 12)),
      'Shift-ArrowLeft': on(() => resizeImage(editor, -12)),
      'Shift-ArrowDown': on(() => resizeImage(editor, 0, 12)),
      'Shift-ArrowUp': on(() => resizeImage(editor, 0, -12)),

      /* ── 미세 이동: Alt + 방향키 ── */
      'Alt-ArrowRight': on(() => nudgeImage(editor, 1, 0)),
      'Alt-ArrowLeft': on(() => nudgeImage(editor, -1, 0)),
      'Alt-ArrowDown': on(() => nudgeImage(editor, 0, 1)),
      'Alt-ArrowUp': on(() => nudgeImage(editor, 0, -1)),

      /* ── 자르기: Alt+Shift + 방향키 (그쪽 변을 더 잘라 낸다) ── */
      'Alt-Shift-ArrowRight': on(() => cropSide(editor, 'r', 0.02)),
      'Alt-Shift-ArrowLeft': on(() => cropSide(editor, 'l', 0.02)),
      'Alt-Shift-ArrowDown': on(() => cropSide(editor, 'b', 0.02)),
      'Alt-Shift-ArrowUp': on(() => cropSide(editor, 't', 0.02)),
      'Alt-x': on(() => clearCrop(editor)),

      /* ── 고르기·옮겨 다니기 ── */
      'Alt-g': onNear(() => selectImage(editor)),
      Tab: on(() => selectNextImage(editor, 1)),
      'Shift-Tab': on(() => selectNextImage(editor, -1)),
      'Alt-n': () => selectNextImage(editor, 1),
      'Alt-N': () => selectNextImage(editor, -1),

      /* ── 문서 안에서 자리 옮기기 ── */
      'Alt-Home': on(() => moveImage(editor, -1)),
      'Alt-End': on(() => moveImage(editor, 1)),

      /* ── 돌리기·뒤집기 ── */
      'Alt-r': onNear(() => rotateImage(editor, 90)),
      'Alt-R': onNear(() => rotateImage(editor, -90)),
      'Alt-h': onNear(() => flipImage(editor, 'h')),
      'Alt-v': onNear(() => flipImage(editor, 'v')),

      /* ── 배치 ── */
      'Alt-w': onNear(() => cycleWrap(1)),
      'Alt-W': onNear(() => cycleWrap(-1)),

      /* ── 크기 되돌리기·맞추기 ── */
      'Alt-0': onNear(() => resetImageSize(editor)),
      'Alt-f': onNear(() => fitImageToBody(editor)),
      'Alt-k': onNear(() => toggleAspectLock(editor)),
      'Alt-l': onNear(() => toggleImageLock(editor)),

      /* ── 서식 ── */
      'Alt-z': onNear(() => resetImageFormat(editor)),
      'Alt-b': onNear(() => copyImageFormat(editor)),
      'Alt-B': onNear(() => pasteImageFormat(editor)),

      /* ── 대화상자 (여기서 나머지 모든 값을 숫자로 정한다) ── */
      'Alt-p': onNear(() => ask('size')),
      'Alt-c': onNear(() => ask('caption')),
      'Alt-a': onNear(() => ask('alt')),
      'Alt-t': onNear(() => ask('adjust')),

      /* ── 무엇을 쓸 수 있는지 ── */
      'Alt-/': onNear(() => {
        flash(
          '그림 단축키 — Shift+방향키 크기 · Alt+방향키 이동 · Alt+Shift+방향키 자르기(Alt+X 되돌리기) · ' +
          'Alt+R 회전(Shift 반대) · Alt+H/V 좌우·상하 대칭 · Alt+W 배치 바꾸기 · Alt+0 원래 크기 · Alt+F 본문 너비 · ' +
          'Alt+K 비율 고정 · Alt+L 개체 보호 · Alt+B 서식 복사(Shift 붙이기) · Alt+Z 서식 지우기 · ' +
          'Alt+P 속성 · Alt+C 캡션 · Alt+A 대체 텍스트 · Alt+T 색 보정 · Tab 다음 그림 · Shift+F10 메뉴',
          9000
        )
        return true
      }),
    }
  },
})
