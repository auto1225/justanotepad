import { create } from 'zustand'
import type { Editor } from '@tiptap/react'

interface DocState {
  content: string
  title: string
  editor: Editor | null
  savedAt: number | null
  fileHandle: FileSystemFileHandle | null
  /** fileHandle 이 어느 메모의 파일인지 — 다른 메모를 엉뚱한 파일에 덮어쓰지 않기 위한 소유자 표시 */
  fileHandleMemoId: string | null
  setContent: (html: string) => void
  setTitle: (title: string) => void
  setEditor: (editor: Editor | null) => void
  setSavedAt: (ts: number) => void
  setFileHandle: (handle: FileSystemFileHandle | null, memoId?: string | null) => void
  reset: () => void
}

export const useDocStore = create<DocState>((set) => ({
  content: '',
  title: '새 메모',
  editor: null,
  savedAt: null,
  fileHandle: null,
  fileHandleMemoId: null,
  setContent: (html) => set({ content: html }),
  setTitle: (title) => set({ title }),
  setEditor: (editor) => set({ editor }),
  setSavedAt: (ts) => set({ savedAt: ts }),
  setFileHandle: (handle, memoId = null) => set({ fileHandle: handle, fileHandleMemoId: handle ? memoId : null }),
  reset: () => set({ content: '', title: '새 메모', savedAt: null, fileHandle: null, fileHandleMemoId: null }),
}))
