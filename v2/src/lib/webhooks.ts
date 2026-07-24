/**
 * Phase 15 — Webhook 발송.
 * settings 의 webhookUrls 에 메모 변경 정보 POST.
 * 지원 이벤트: memo-saved, memo-deleted, memo-shared.
 */
import { useSettingsStore } from '../store/settingsStore'

export type WebhookEvent =
  | { type: 'memo-saved'; memoId: string; title: string; charCount: number }
  | { type: 'memo-deleted'; memoId: string; title: string }
  | { type: 'memo-shared'; memoId: string; title: string; url: string }

export async function dispatchWebhook(event: WebhookEvent): Promise<void> {
  const s = useSettingsStore.getState()
  const urls = (s.webhookUrls?.split(/\s+/).filter(Boolean) || []).filter((u) => /^https?:\/\//i.test(u))
  if (urls.length === 0) return

  const payload = {
    ...event,
    app: 'JustANotepad',
    version: 2,
    ts: Date.now(),
  }

  // fire-and-forget, 5초 타임아웃
  for (const url of urls) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 5000)
    try {
      await fetch(url, {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      console.warn('[webhook] failed:', new URL(url).origin, e)
    } finally {
      clearTimeout(t)
    }
  }
}
