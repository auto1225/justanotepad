import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { allowTransaction } from '../lib/docProtect'
import { trackAuthor } from './TrackChanges'

/**
 * 편집 제한 문지기 — 「읽기만」·「메모만」 같은 제한을 실제로 지키게 한다.
 *
 * 리본 단추를 흐리게 하는 것만으로는 새지 않게 막을 수 없다 (붙여넣기·끌어놓기·
 * 단축키·되돌리기까지 길이 많다). 문서로 들어가는 모든 변경이 이 문 하나를 지난다.
 */
export const EditGuard = Extension.create({
  name: 'janEditGuard',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('janEditGuard'),
        filterTransaction: (tr, state) => allowTransaction(tr, state, {
          tracking: !!(editor.storage as unknown as Record<string, { on?: boolean }>).janTrack?.on,
          author: trackAuthor(),
        }),
      }),
    ]
  },
})
