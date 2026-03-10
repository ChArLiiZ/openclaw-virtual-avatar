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
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-2">
      <div className="group relative w-[280px] select-none">
        <div className="absolute inset-x-8 bottom-8 h-20 rounded-full bg-primary/25 blur-3xl" />
        <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/55 p-4 shadow-glow backdrop-blur-xl">
          <div className="absolute inset-0 bg-avatar-grid bg-[size:20px_20px] opacity-25" />
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex w-full items-center justify-between">
              <Badge variant="secondary">Avatar</Badge>
              <Badge variant={state === 'speaking' ? 'success' : state === 'listening' ? 'warning' : state === 'error' ? 'warning' : 'outline'}>
                {stateLabel[state]}
              </Badge>
            </div>

            <div className="relative flex h-[320px] w-full items-center justify-center rounded-[1.75rem] border border-primary/20 bg-gradient-to-b from-primary/15 via-background/15 to-background/5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_42%)]" />
              <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-primary/30 bg-secondary/50">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Sparkles className="size-9" />
                  </div>
                  <div className="text-lg font-semibold">VRM / Live2D</div>
                  <p className="mt-2 px-5 text-sm text-muted-foreground">平常就停在桌面上，滑鼠移上來再露出操作。</p>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center opacity-0 transition duration-200 group-hover:opacity-100">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/85 p-2 shadow-glow backdrop-blur">
                  <Button size="icon" onClick={onOpenChat} aria-label="Open chat"><MessageCircle className="size-4" /></Button>
                  <Button size="icon" variant="secondary" onClick={onStartVoice} aria-label="Open record window"><Mic className="size-4" /></Button>
                  <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="Open settings"><Settings className="size-4" /></Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
