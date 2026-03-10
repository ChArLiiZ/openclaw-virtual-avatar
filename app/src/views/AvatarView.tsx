import { MessageCircle, Mic, Settings, Sparkles } from 'lucide-react'
import type { AvatarState } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const stateLabel: Record<AvatarState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Error',
}

export function AvatarView({ state, onOpenChat, onStartVoice, onOpenSettings }: {
  state: AvatarState
  onOpenChat: () => void
  onStartVoice: () => void
  onOpenSettings: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-6">
      <div className="group relative w-[340px] select-none">
        <div className="absolute inset-x-10 bottom-8 h-20 rounded-full bg-primary/25 blur-3xl" />
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-glow backdrop-blur-xl">
          <div className="absolute inset-0 bg-avatar-grid bg-[size:20px_20px] opacity-30" />
          <div className="relative flex flex-col items-center gap-5">
            <div className="flex w-full items-center justify-between">
              <Badge variant="secondary">Avatar Window</Badge>
              <Badge variant={state === 'speaking' ? 'success' : state === 'listening' ? 'warning' : state === 'error' ? 'warning' : 'outline'}>
                {stateLabel[state]}
              </Badge>
            </div>

            <div className="relative flex h-[380px] w-full items-center justify-center rounded-[1.75rem] border border-primary/20 bg-gradient-to-b from-primary/15 via-background/20 to-background/5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_42%)]" />
              <div className="relative flex h-64 w-64 items-center justify-center rounded-full border border-primary/30 bg-secondary/60">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Sparkles className="size-9" />
                  </div>
                  <div className="text-lg font-semibold">VRM / Live2D</div>
                  <p className="mt-2 px-6 text-sm text-muted-foreground">未來常駐桌面的角色主舞台。滑鼠移上來才露出操作鈕。</p>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center opacity-0 transition duration-200 group-hover:opacity-100">
                <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/70 bg-background/85 p-2 shadow-glow backdrop-blur">
                  <Button size="icon" onClick={onOpenChat} aria-label="Open chat"><MessageCircle className="size-4" /></Button>
                  <Button size="icon" variant="secondary" onClick={onStartVoice} aria-label="Start voice input"><Mic className="size-4" /></Button>
                  <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="Open settings"><Settings className="size-4" /></Button>
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                <div className="font-medium text-foreground">Expression</div>
                <div className="mt-1 text-muted-foreground">idle</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                <div className="font-medium text-foreground">Lip sync</div>
                <div className="mt-1 text-muted-foreground">pending</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
                <div className="font-medium text-foreground">Window</div>
                <div className="mt-1 text-muted-foreground">compact</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
