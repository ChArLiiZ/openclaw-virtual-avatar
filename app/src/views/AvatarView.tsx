import { useEffect, useState } from 'react'
import { GripVertical, MessageCircle, Mic, Settings, Sparkles, X } from 'lucide-react'
import type { AvatarState, RecordingStatus } from '@/types'
import { Button } from '@/components/ui/button'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AvatarView({
  state,
  recordingStatus,
  recordingDuration,
  onOpenChat,
  onToggleRecording,
  onCancelRecording,
  onOpenSettings,
}: {
  state: AvatarState
  recordingStatus: RecordingStatus
  recordingDuration: number
  onOpenChat: () => void
  onToggleRecording: () => void
  onCancelRecording: () => void
  onOpenSettings: () => void
}) {
  const isRecording = recordingStatus === 'recording'
  const isProcessing = recordingStatus === 'processing' || state === 'listening'
  const [hovered, setHovered] = useState(false)

  // Make body/html fully transparent so Tauri transparent window works.
  // On Windows, fully-transparent pixels (alpha=0) pass clicks through
  // to windows behind automatically — no setIgnoreCursorEvents needed.
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.backgroundImage = 'none'
    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
      document.body.style.backgroundImage = ''
    }
  }, [])

  return (
    <main className="flex min-h-screen select-none items-center justify-center"
      style={{ background: 'transparent' }}
    >
      <div
        className="flex flex-col items-center gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Idle state ── */}
        {!isRecording && !isProcessing && (
          <>
            {/* Avatar icon */}
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-card/80 text-primary shadow-glow transition-opacity duration-200 ${
                hovered ? 'opacity-40' : 'opacity-90'
              }`}
            >
              <Sparkles className="size-6" />
            </div>

            {/* Action buttons — appear on hover */}
            <div
              className={`flex items-center gap-1.5 rounded-full border border-border/70 bg-background/85 p-1.5 shadow-glow transition-all duration-200 ${
                hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              <Button size="icon" className="h-8 w-8" onClick={onOpenChat} aria-label="Open chat">
                <MessageCircle className="size-3.5" />
              </Button>
              <Button size="icon" className="h-8 w-8" variant="secondary" onClick={onToggleRecording} aria-label="Start recording">
                <Mic className="size-3.5" />
              </Button>
              <Button size="icon" className="h-8 w-8" variant="outline" onClick={onOpenSettings} aria-label="Open settings">
                <Settings className="size-3.5" />
              </Button>
              <div
                data-tauri-drag-region
                className="flex h-8 w-8 cursor-move items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Drag to move"
              >
                <GripVertical className="size-3.5 pointer-events-none" />
              </div>
            </div>
          </>
        )}

        {/* ── Recording state ── */}
        {isRecording && (
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
              <button
                onClick={onToggleRecording}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-500/80 text-white shadow-lg transition hover:bg-red-600"
              >
                <Mic className="size-6" />
              </button>
            </div>
            <div className="rounded-full bg-red-500/80 px-3 py-0.5 text-xs font-semibold text-white">
              {formatDuration(recordingDuration)}
            </div>
            <button
              onClick={onCancelRecording}
              className="flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-0.5 text-xs text-muted-foreground transition hover:bg-background/95"
            >
              <X className="size-3" /> Cancel
            </button>
          </div>
        )}

        {/* ── Processing state ── */}
        {isProcessing && (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-yellow-500/40 bg-yellow-500/20 text-yellow-400 shadow-glow">
            <div className="animate-spin">
              <Sparkles className="size-6" />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
