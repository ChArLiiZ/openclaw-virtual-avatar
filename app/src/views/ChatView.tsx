import { useEffect } from 'react'
import { LoaderCircle, MessageCircle, SendHorizonal, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { AvatarState, ChatMessage } from '@/types'

export function ChatView({
  state,
  draft,
  messages,
  busy,
  onDraftChange,
  onOpenSettings,
  onSend,
  onClose,
}: {
  state: AvatarState
  draft: string
  messages: ChatMessage[]
  busy: boolean
  onDraftChange: (value: string) => void
  onOpenSettings: () => void
  onSend: () => void
  onClose: () => void
}) {
  // Escape key hides chat window (only when textarea is not focused)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        const active = document.activeElement
        if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-card/80 px-4 py-3 shadow-glow backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/20 p-2 text-primary">
            <MessageCircle className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Chat</div>
            <div className="text-xs text-muted-foreground">state: {state}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onOpenSettings}><Settings2 className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="size-4" /></Button>
        </div>
      </header>

      <Card className="flex-1">
        <CardContent className="flex h-[calc(100vh-180px)] flex-col gap-4 p-4">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'system'
                        ? 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-100'
                        : 'border border-border/70 bg-background/60 text-foreground'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.25rem] border border-border/70 bg-background/50 p-3">
            <Textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="直接打字和角色說話。錄音會在另一個小視窗處理。"
              className="min-h-[110px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={onSend} disabled={busy || !draft.trim()}>
                {busy && state === 'thinking' ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />} Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
