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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packet))
  window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: packet }))
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

  const handlePacket = (packet: any) => {
    if (!packet?.id || seen.has(packet.id)) return
    seen.add(packet.id)
    listener(packet.payload as BridgePayload)
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      handlePacket(JSON.parse(event.newValue))
    } catch {
      // ignore malformed packet
    }
  }

  const onCustom = (event: Event) => {
    const custom = event as CustomEvent
    handlePacket(custom.detail)
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(STORAGE_KEY, onCustom as EventListener)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(STORAGE_KEY, onCustom as EventListener)
  }
}
