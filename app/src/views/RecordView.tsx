import { useEffect } from 'react'
import { Mic, MicOff, Upload, WandSparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AvatarState, RecordingStatus } from '@/types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordView({
  state,
  busy,
  recordingStatus,
  recordingDuration,
  onPickAudio,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onClose,
}: {
  state: AvatarState
  busy: boolean
  recordingStatus: RecordingStatus
  recordingDuration: number
  onPickAudio: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onClose: () => void
}) {
  const isRecording = recordingStatus === 'recording'
  const isProcessing = recordingStatus === 'processing' || busy || state === 'listening'
  const isIdle = recordingStatus === 'idle' && !busy && state !== 'listening'

  // Keyboard shortcuts: Space = push-to-talk, Escape = cancel or close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space' && isIdle) {
        e.preventDefault()
        onStartRecording()
      }
      if (e.code === 'Escape') {
        e.preventDefault()
        if (isRecording) {
          onCancelRecording()
        } else {
          onClose()
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault()
        onStopRecording()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isIdle, isRecording, onStartRecording, onStopRecording, onCancelRecording, onClose])

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-3 w-fit">Record</Badge>
              <CardTitle className="text-2xl">Voice Input</CardTitle>
              <CardDescription>按住按鈕說話，放開後自動送出 STT。也可以選擇音檔上傳。</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status display */}
          <div className="rounded-[1.5rem] border border-border/70 bg-background/40 p-6 text-center">
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              {isRecording && (
                <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
              )}
              <div className={`relative flex h-20 w-20 items-center justify-center rounded-full ${
                isRecording
                  ? 'bg-red-500/20 text-red-400'
                  : isProcessing
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-primary/20 text-primary'
              }`}>
                {isProcessing ? (
                  <WandSparkles className="size-8" />
                ) : isRecording ? (
                  <MicOff className="size-8" />
                ) : (
                  <Mic className="size-8" />
                )}
              </div>
            </div>

            <div className="text-lg font-semibold">
              {isRecording
                ? formatDuration(recordingDuration)
                : isProcessing
                  ? 'Whisper processing…'
                  : 'Ready'}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRecording
                ? '放開按鈕或 Space 鍵停止錄音'
                : isProcessing
                  ? '正在辨識語音…'
                  : '按住下方按鈕或 Space 鍵開始錄音'}
            </p>
          </div>

          {/* Push-to-talk button */}
          <Button
            className={`h-16 w-full text-base ${isRecording ? 'bg-red-600 hover:bg-red-700' : ''}`}
            disabled={isProcessing}
            onPointerDown={(e) => {
              if (isIdle) {
                e.preventDefault()
                onStartRecording()
              }
            }}
            onPointerUp={(e) => {
              if (isRecording) {
                e.preventDefault()
                onStopRecording()
              }
            }}
            onPointerLeave={() => {
              // If pointer leaves the button while held, stop recording
              if (isRecording) onStopRecording()
            }}
          >
            <Mic className="size-5" />
            {isRecording ? 'Release to send' : isProcessing ? 'Processing…' : 'Hold to talk'}
          </Button>

          {/* Cancel button during recording */}
          {isRecording && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onCancelRecording}
            >
              Cancel (Esc)
            </Button>
          )}

          {/* File upload fallback */}
          {isIdle && (
            <Button variant="outline" className="w-full" onClick={onPickAudio}>
              <Upload className="size-4" /> Upload audio file
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
