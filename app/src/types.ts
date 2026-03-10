export type ViewMode = 'avatar' | 'chat' | 'record' | 'settings'
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  text: string
}
