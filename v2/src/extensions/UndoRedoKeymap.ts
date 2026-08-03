import { Extension } from '@tiptap/core'

/**
 * 다시 하기가 되돌리기로 둔갑하던 것 — Ctrl+Shift+Z 를 우리가 끝까지 삼킨다.
 *
 * ProseMirror 의 키 처리기는 「글자 키 + Shift」 로 짝을 못 찾으면 **Shift 를 뗀 이름으로 한 번 더**
 * 찾아본다. (Shift+2 로 @ 를 치는 자판을 받아 주려는 배려다.) 다시 할 것이 남지 않아
 * Shift-Mod-z 가 「나는 안 했다」 고 돌려주는 순간, 그 배려가 Mod-z 를 찾아내어 **되돌리기**를
 * 해 버렸다. 재어 보니 Ctrl+Shift+Z 를 잇달아 누르면 다시하기와 되돌리기가 번갈아 돌았다
 * (다시4293자 → 되돌림4288자 → 다시4293자 …). 다시 하려던 사람이 방금 쓴 글을 잃는다.
 *
 * 그래서 이 자리에서 늘 「내가 처리했다」 고 답한다. 다시 할 것이 없으면 아무 일도 일어나지
 * 않는 것이 옳다 — 워드·한글도 그렇다.
 *
 * 이력이 없는 편집기(창 나누기 보조 · 쪽 나란히 보기)에서는 손대지 않고 넘긴다.
 * 그쪽은 제 키맵으로 메인 편집기에 중계하고 있다.
 */
export const UndoRedoKeymap = Extension.create({
  name: 'janUndoRedoKeymap',
  // 기본 undoRedo 키맵보다 먼저 잡아야 Shift 를 떼는 되짚기까지 가지 않는다
  priority: 200,

  addKeyboardShortcuts() {
    const redo = () => {
      const cmds = this.editor.commands as unknown as Record<string, (() => boolean) | undefined>
      if (!cmds.redo) return false // 이 편집기에는 이력이 없다 — 중계 키맵에 맡긴다
      cmds.redo()
      return true
    }
    return {
      'Shift-Mod-z': redo,
      'Shift-Mod-я': redo, // 러시아 자판 (기본 확장과 짝을 맞춘다)
    }
  },
})
