import { AudioLines, Bot, Cable, Mic, Play, RefreshCw, Settings2, Sparkles, Waves } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import type { AvatarState } from '@/types'
import type { HealthInfo } from '@/lib/api'

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block size-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-yellow-400'}`} />
}

function SectionTitle({ icon: Icon, title, desc }: { icon: typeof Sparkles; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-primary/20 p-2 text-primary"><Icon className="size-5" /></div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

export function SettingsView({
  serverUrl,
  pythonUrl,
  voice,
  text,
  transcript,
  avatarState,
  nodeHealth,
  pythonHealth,
  loadingHealth,
  healthError,
  onRefreshHealth,
  onServerUrlChange,
  onPythonUrlChange,
  onVoiceChange,
  onTextChange,
  onTranscriptChange,
  onGenerateSpeech,
}: {
  serverUrl: string
  pythonUrl: string
  voice: string
  text: string
  transcript: string
  avatarState: AvatarState
  nodeHealth: HealthInfo | null
  pythonHealth: HealthInfo | null
  loadingHealth: boolean
  healthError: string | null
  onRefreshHealth: () => void
  onServerUrlChange: (value: string) => void
  onPythonUrlChange: (value: string) => void
  onVoiceChange: (value: string) => void
  onTextChange: (value: string) => void
  onTranscriptChange: (value: string) => void
  onGenerateSpeech: () => void
}) {
  const roadmap = [
    '把現在的大頁面正式定位成設定 / 控制中心',
    '做小角色視窗與 hover actions',
    '做聊天窗與完整互動回路',
    '接上真實 TTS / STT / playback',
    '最後再把右側舞台換成 VRM / Live2D renderer',
  ]

  const modelLoadedCount = Number(Boolean(pythonHealth?.models_loaded?.tts)) + Number(Boolean(pythonHealth?.models_loaded?.stt))

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-border/70 bg-card/70 p-6 shadow-glow backdrop-blur md:flex-row md:items-center">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit">Settings / Control Center</Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Virtual Avatar Studio</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              這裡不再是主角色頁，而是之後負責 server、voice、模型、debug 與行為設定的控制中心。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onRefreshHealth} disabled={loadingHealth}><RefreshCw className={`size-4 ${loadingHealth ? 'animate-spin' : ''}`} /> Refresh status</Button>
          <Button variant="outline"><Bot className="size-4" /> Avatar state: {avatarState}</Button>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Cable className="size-5 text-primary" /> Service status</CardTitle>
              <CardDescription>控制中心用來看整個系統的健康狀態，而不是取代主角色視窗。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Node proxy</span><StatusDot ok={nodeHealth?.status === 'ok'} /></div>
                  <div className="mt-3 font-medium">{nodeHealth?.status || 'unknown'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{serverUrl}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Python service</span><StatusDot ok={pythonHealth?.status === 'ok'} /></div>
                  <div className="mt-3 font-medium">{pythonHealth?.status || 'unknown'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{pythonUrl}</div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Models</span><StatusDot ok={Boolean(pythonHealth?.models_loaded?.tts || pythonHealth?.models_loaded?.stt)} /></div>
                  <div className="mt-3 font-medium">{modelLoadedCount}/2 loaded</div>
                  <div className="mt-1 text-xs text-muted-foreground">idle unload: {pythonHealth?.model_idle_seconds ?? 'unknown'}s</div>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-border/70 bg-background/30 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Model residency</span>
                  <span>{modelLoadedCount} / 2</span>
                </div>
                <Progress value={(modelLoadedCount / 2) * 100} />
                {healthError ? <div className="text-xs text-yellow-200">{healthError}</div> : null}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionTitle icon={AudioLines} title="TTS / Voice settings" desc="之後用來管理預設 voice、TTS 測試、播放與雲端 / 本地 provider 切換。" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">Node proxy URL</Label>
                  <Input id="serverUrl" value={serverUrl} onChange={(e) => onServerUrlChange(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pythonUrl">Python service URL</Label>
                  <Input id="pythonUrl" value={pythonUrl} onChange={(e) => onPythonUrlChange(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voice">Voice</Label>
                  <Input id="voice" value={voice} onChange={(e) => onVoiceChange(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttsText">TTS test text</Label>
                  <Textarea id="ttsText" value={text} onChange={(e) => onTextChange(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={onGenerateSpeech}><Sparkles className="size-4" /> Generate speech</Button>
                  <Button variant="secondary"><Play className="size-4" /> Play result</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionTitle icon={Mic} title="Input / STT settings" desc="麥克風、上傳、轉錄與未來的即時語音互動控制都會放在這裡。" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-24 flex-col"><Mic className="size-6" /> Hold to talk</Button>
                  <Button variant="secondary" className="h-24 flex-col"><Waves className="size-6" /> Upload audio</Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transcript">Transcript / draft</Label>
                  <Textarea id="transcript" value={transcript} onChange={(e) => onTranscriptChange(e.target.value)} placeholder="之後會顯示 STT 結果、也能作為對話輸入草稿。" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button><Bot className="size-4" /> Route to chat window</Button>
                  <Button variant="outline"><Settings2 className="size-4" /> Input devices later</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Settings2 className="size-5 text-primary" /> Build path</CardTitle>
              <CardDescription>現在的目標是把產品分成小角色窗、聊天窗、設定中心三個角色清楚的界面。</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                {roadmap.map((item, index) => (
                  <li key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-background/30 px-4 py-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">Avatar Stage Preview</CardTitle>
              <CardDescription>這裡現在只是設定頁裡的預覽。真正常駐桌面的小角色窗會是獨立視圖。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative flex min-h-[580px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-background/60 p-6">
                <div className="absolute inset-0 bg-avatar-grid bg-[size:22px_22px] opacity-40" />
                <div className="absolute inset-x-10 bottom-10 h-24 rounded-full bg-primary/20 blur-3xl" />
                <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
                  <div className="flex size-72 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-b from-primary/20 to-transparent shadow-glow">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex size-24 items-center justify-center rounded-full bg-secondary text-primary">
                        <Sparkles className="size-10" />
                      </div>
                      <p className="text-lg font-semibold">Avatar preview</p>
                      <p className="mt-2 text-sm text-muted-foreground">未來這裡會顯示目前載入的 VRM / Live2D 與狀態預覽。</p>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="font-medium text-foreground">Expression</div>
                      <div className="mt-1">idle</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="font-medium text-foreground">Lip sync</div>
                      <div className="mt-1">pending</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/40 p-3">
                      <div className="font-medium text-foreground">Model</div>
                      <div className="mt-1">none</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
