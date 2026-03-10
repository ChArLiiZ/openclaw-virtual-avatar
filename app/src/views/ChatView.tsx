import { LoaderCircle, Mic, Paperclip, Play, SendHorizonal, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { AvatarState, ChatMessage } from '@/types'

export function ChatView({
  state,
  draft,
  messages,
  busy,
  currentAudioLabel,
  onDraftChange,
  onOpenSettings,
  onSend,
  onPickAudio,
  onReplay,
  fileInputRef,
}: {
  state: AvatarState
  draft: string
  messages: ChatMessage[]
  busy: boolean
  currentAudioLabel?: string | null
  onDraftChange: (value: string) => void
  onOpenSettings: () => void
  onSend: () => void
  onPickAudio: () => void
  onReplay: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-6 py-8">
      <header className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-border/70 bg-card/70 p-5 shadow-glow backdrop-blur">
        <div>
          <Badge variant="secondary" className="mb-3">Chat Window</Badge>
          <h1 className="text-2xl font-semibold">Conversation</h1>
          <p className="mt-1 text-sm text-muted-foreground">這裡現在已開始接 TTS / STT。接下來再把真正的角色邏輯與多輪對話補上。</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">state: {state}</Badge>
          <Button variant="outline" onClick={onOpenSettings}>Settings</Button>
        </div>
      </header>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Dialogue Loop</CardTitle>
          <CardDescription>文字送出會先走 TTS；上傳音檔會走 STT 並把結果塞回對話。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-3xl px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'system'
                        ? 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-100'
                        : 'border border-border/70 bg-background/50 text-foreground'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Textarea
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="在這裡打字。按 Send 會呼叫 TTS；上傳音檔可先試 STT。"
              className="min-h-[120px]"
            />
            <div className="flex flex-col gap-3 md:w-[190px]">
              <Button className="h-14 justify-start" onClick={onSend} disabled={busy || !draft.trim()}>
                {busy && state === 'thinking' ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />} Send
              </Button>
              <Button variant="secondary" className="h-14 justify-start" onClick={onPickAudio} disabled={busy}>
                <Paperclip className="size-4" /> Upload for STT
              </Button>
              <Button variant="outline" className="h-14 justify-start" onClick={onReplay} disabled={!currentAudioLabel || busy}>
                <Play className="size-4" /> Replay last TTS
              </Button>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" />

          <div className="rounded-2xl border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground"><Mic className="size-4 text-primary" /> Current audio state</div>
            <div className="mt-1">{currentAudioLabel ? `Last TTS clip ready: ${currentAudioLabel}` : '還沒有產生可重播的 TTS 音訊。'}</div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
