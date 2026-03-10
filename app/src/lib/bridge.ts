import type { ChatMessage } from '@/types'

const STORAGE_KEY = 'virtual-avatar-bridge'

export type BridgePayload =
  | { type: 'chat-message'; message: ChatMessage }
  | { type: 'draft-set'; text: string }
  | { type: 'stt-result'; text: string }

function dispatch(payload: BridgePayload) {
  const packet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    payload,
  }
  // Only use localStorage — the `storage` event fires in OTHER windows.
  // Same-window state is already updated directly by the caller (appendMessage, setDraft, etc.)
  // Previously we also dispatched a CustomEvent for same-window notification,
  // but that caused duplicates since the caller already updates local state.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packet))
}

export function sendChatMessage(message: ChatMessage) {
  dispatch({ type: 'chat-message', message })
}

export function setSharedDraft(text: string) {
  dispatch({ type: 'draft-set', text })
}

export function publishSttResult(text: string) {
  dispatch({ type: 'stt-result', text })
}

export function subscribeBridge(listener: (payload: BridgePayload) => void) {
  const seen = new Set<string>()

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      const packet = JSON.parse(event.newValue)
      if (!packet?.id || seen.has(packet.id)) return
      seen.add(packet.id)
      listener(packet.payload as BridgePayload)
    } catch {
      // ignore malformed packet
    }
  }

  // Only listen to `storage` events (fired in OTHER windows).
  // Same-window state is updated directly by callers, no CustomEvent needed.
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
