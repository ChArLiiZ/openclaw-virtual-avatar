import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Mic, Settings, Sparkles, X } from 'lucide-react'
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

  // Make body/html fully transparent so Tauri transparent window works
  // (other windows keep their dark theme since each window is a separate webview)
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

  const onMouseEnter = useCallback(() => setHovered(true), [])
  const onMouseLeave = useCallback(() => setHovered(false), [])

  return (
    <main className="flex min-h-screen select-none items-end justify-center bg-transparent pb-6">
      <div
        className="flex flex-col items-center gap-3"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Avatar icon — draggable, fades on hover */}
        {!isRecording && !isProcessing && (
          <div
            data-tauri-drag-region
            className={`flex h-16 w-16 cursor-move items-center justify-center rounded-full border border-primary/30 bg-card/70 text-primary shadow-glow backdrop-blur transition-opacity duration-200 ${
              hovered ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <Sparkles className="size-7 pointer-events-none" />
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
              <button
                onClick={onToggleRecording}
                className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500/80 text-white shadow-lg backdrop-blur transition hover:bg-red-600"
              >
                <Mic className="size-7" />
              </button>
            </div>
            <div className="rounded-full bg-red-500/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {formatDuration(recordingDuration)}
            </div>
            <button
              onClick={onCancelRecording}
              className="flex items-center gap-1 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:bg-background/90"
            >
              <X className="size-3" /> Cancel
            </button>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-yellow-500/40 bg-yellow-500/20 text-yellow-400 shadow-glow backdrop-blur">
            <div className="animate-spin">
              <Sparkles className="size-7" />
            </div>
          </div>
        )}

        {/* Action buttons — shown on hover, hidden during recording */}
        {!isRecording && !isProcessing && (
          <div
            className={`flex items-center gap-2 rounded-full border border-border/70 bg-background/85 p-2 shadow-glow backdrop-blur transition-opacity duration-200 ${
              hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Button size="icon" onClick={onOpenChat} aria-label="Open chat">
              <MessageCircle className="size-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={onToggleRecording} aria-label="Start recording">
              <Mic className="size-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="Open settings">
              <Settings className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
