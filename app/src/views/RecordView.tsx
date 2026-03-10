import { Mic, Upload, WandSparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AvatarState } from '@/types'

export function RecordView({
  state,
  busy,
  onPickAudio,
  onClose,
}: {
  state: AvatarState
  busy: boolean
  onPickAudio: () => void
  onClose: () => void
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-3 w-fit">Record</Badge>
              <CardTitle className="text-2xl">Voice Input</CardTitle>
              <CardDescription>先保持單純。選音檔 → Whisper STT → 結果送回聊天流程。</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="size-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[1.5rem] border border-border/70 bg-background/40 p-6 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
              {busy || state === 'listening' ? <WandSparkles className="size-8" /> : <Mic className="size-8" />}
            </div>
            <div className="text-lg font-semibold">{busy || state === 'listening' ? 'Whisper processing…' : 'Ready'}</div>
            <p className="mt-2 text-sm text-muted-foreground">之後再接 push-to-talk。現在先確保錄音 / STT / 丟回對話這條鏈穩定。</p>
          </div>

          <Button className="h-14 w-full" onClick={onPickAudio} disabled={busy}>
            <Upload className="size-4" /> Select audio file
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
