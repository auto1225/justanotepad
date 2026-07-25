/**
 * Phase 9 — Yjs 협업 hook.
 * 설정의 collabEnabled + collabWsUrl + collabRoom + collabUserName 을 감시해
 * Y.Doc + WebsocketProvider 를 시작/중지하고 connection state 를 노출.
 */
import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useSettingsStore } from '../store/settingsStore'

export interface CollabState {
  ydoc: Y.Doc | null
  provider: WebsocketProvider | null
  status: 'disconnected' | 'connecting' | 'connected'
  peers: number
}

export function useCollab(): CollabState {
  const { collabEnabled, collabWsUrl, collabRoom, collabUserName } = useSettingsStore()
  const [state, setState] = useState<CollabState>({
    ydoc: null,
    provider: null,
    status: 'disconnected',
    peers: 0,
  })

  useEffect(() => {
    // 협업이 꺼져 있으면 아무것도 열지 않는다 — 열려 있던 연결은 이전 effect 의 정리 단계에서 닫힌다
    if (!collabEnabled || !collabWsUrl || !collabRoom) return
    const ydoc = new Y.Doc()
    const provider = new WebsocketProvider(collabWsUrl, collabRoom, ydoc)
    provider.awareness.setLocalStateField('user', {
      name: collabUserName || 'Anonymous',
      color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    })

    const updateStatus = () => {
      setState((s) => ({
        ...s,
        ydoc,
        provider,
        status: provider.wsconnected ? 'connected' : provider.wsconnecting ? 'connecting' : 'disconnected',
        peers: provider.awareness.getStates().size,
      }))
    }
    provider.on('status', updateStatus)
    provider.awareness.on('change', updateStatus)
    updateStatus()

    return () => {
      provider.off('status', updateStatus)
      provider.awareness.off('change', updateStatus)
      provider.disconnect()
      provider.destroy()
      ydoc.destroy()
      setState({ ydoc: null, provider: null, status: 'disconnected', peers: 0 })
    }
  }, [collabEnabled, collabWsUrl, collabRoom, collabUserName])

  return state
}
