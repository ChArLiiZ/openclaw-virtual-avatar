import { useRef, useState } from 'react'
import { AudioLines, Bot, Cable, Check, Loader2, Mic, Play, Plus, RefreshCw, Settings2, Sparkles, Square, Trash2, Upload, Waves } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import type { AvatarState } from '@/types'
import type { GatewayHealthResult, HealthInfo, VoiceInfo } from '@/lib/api'

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

function VoiceList({
  voices,
  active,
  onSelect,
  onDelete,
  onTrain,
  actionBusy,
}: {
  voices: VoiceInfo[]
  active: string
  onSelect: (name: string) => void
  onDelete: (name: string) => Promise<void>
  onTrain: (name: string) => Promise<void>
  actionBusy: boolean
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [training, setTraining] = useState<string | null>(null)

  async function handleDelete(name: string) {
    setDeleting(name)
    try {
      await onDelete(name)
    } finally {
      setDeleting(null)
    }
  }

  async function handleTrain(name: string) {
    setTraining(name)
    try {
      await onTrain(name)
    } finally {
      setTraining(null)
    }
  }

  if (!voices.length) {
    return <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3 text-sm text-muted-foreground">No voices found. Upload one below.</div>
  }

  return (
    <div className="space-y-1.5">
      {voices.map((v) => {
        const isActive = v.name === active
        return (
          <div
            key={v.name}
            className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors cursor-pointer ${
              isActive
                ? 'border-primary/50 bg-primary/10 text-foreground'
                : 'border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:bg-background/50'
            }`}
            onClick={() => onSelect(v.name)}
          >
            {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
            <span className="flex-1 truncate font-medium">{v.name}</span>
            <Badge variant={v.speaker_ready ? 'secondary' : 'outline'} className="h-6 px-2 text-[10px]">
              {v.speaker_ready ? 'Speaker ready' : 'Untrained'}
            </Badge>
            {!v.speaker_ready && isActive ? (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation()
                  void handleTrain(v.name)
                }}
                disabled={training === v.name || deleting === v.name || actionBusy}
              >
                {training === v.name ? <RefreshCw className="size-3 animate-spin" /> : 'Train'}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete(v.name)
              }}
              disabled={deleting === v.name || training === v.name}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function VoiceUploadForm({ onUpload }: { onUpload: (name: string, audioFile: File, refText: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [refText, setRefText] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!name.trim() || !audioFile || !refText.trim()) return
    setUploading(true)
    setError(null)
    try {
      await onUpload(name.trim(), audioFile, refText.trim())
      setName('')
      setRefText('')
      setAudioFile(null)
      setExpanded(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setExpanded(true)}>
        <Plus className="size-4" /> Add new voice
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/30 p-3">
      <div className="text-sm font-medium">Upload new voice</div>
      <div className="space-y-2">
        <Label htmlFor="newVoiceName" className="text-xs">Voice name</Label>
        <Input id="newVoiceName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. vivian" className="h-8 text-sm" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="refAudio" className="text-xs">Reference audio (.wav)</Label>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            id="refAudio"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> {audioFile ? audioFile.name : 'Choose audio file'}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="refText" className="text-xs">Reference text (transcription of the audio)</Label>
        <Textarea
          id="refText"
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          placeholder="Type the exact transcription of the reference audio..."
          className="min-h-[60px] text-sm"
        />
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 flex-1"
          onClick={() => void handleSubmit()}
          disabled={uploading || !name.trim() || !audioFile || !refText.trim()}
        >
          {uploading ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setExpanded(false)}>Cancel</Button>
      </div>
    </div>
  )
}

export function SettingsView({
  serverUrl,
  pythonUrl,
  gatewayUrl,
  gatewayToken,
  gatewayAgentId,
  gatewayUser,
  voice,
  voices,
  voicesLoading,
  voicesError,
  text,
  transcript,
  avatarState,
  nodeHealth,
  pythonHealth,
  loadingHealth,
  healthError,
  onRefreshHealth,
  onRefreshVoices,
  onServerUrlChange,
  onPythonUrlChange,
  onGatewayUrlChange,
  onGatewayTokenChange,
  onGatewayAgentIdChange,
  onGatewayUserChange,
  onVoiceChange,
  onUploadVoice,
  onDeleteVoice,
  onTrainVoice,
  onTextChange,
  onTranscriptChange,
  canGenerateSpeech,
  voiceActionBusy,
  onGenerateSpeech,
  ttsTestStatus,
  ttsTestError,
  onPlayTestAudio,
  onStopTestAudio,
  gatewayHealth,
  gatewayTesting,
  onTestGateway,
}: {
  serverUrl: string
  pythonUrl: string
  gatewayUrl: string
  gatewayToken: string
  gatewayAgentId: string
  gatewayUser: string
  voice: string
  voices: VoiceInfo[]
  voicesLoading: boolean
  voicesError: string | null
  text: string
  transcript: string
  avatarState: AvatarState
  nodeHealth: HealthInfo | null
  pythonHealth: HealthInfo | null
  loadingHealth: boolean
  healthError: string | null
  onRefreshHealth: () => void
  onRefreshVoices: () => void
  onServerUrlChange: (value: string) => void
  onPythonUrlChange: (value: string) => void
  onGatewayUrlChange: (value: string) => void
  onGatewayTokenChange: (value: string) => void
  onGatewayAgentIdChange: (value: string) => void
  onGatewayUserChange: (value: string) => void
  onVoiceChange: (value: string) => void
  onUploadVoice: (name: string, audioFile: File, refText: string) => Promise<void>
  onDeleteVoice: (name: string) => Promise<void>
  onTrainVoice: (name: string) => Promise<void>
  onTextChange: (value: string) => void
  onTranscriptChange: (value: string) => void
  canGenerateSpeech: boolean
  voiceActionBusy: boolean
  onGenerateSpeech: () => void
  ttsTestStatus: 'idle' | 'generating' | 'ready' | 'playing' | 'error'
  ttsTestError: string | null
  onPlayTestAudio: () => void
  onStopTestAudio: () => void
  gatewayHealth: GatewayHealthResult | null
  gatewayTesting: boolean
  onTestGateway: () => void
}) {
  const roadmap = [
    '把現在的大頁面正式定位成設定 / 控制中心',
    '做小角色視窗與 hover actions',
    '做聊天窗與完整互動回路',
    '接上真實 TTS / STT / playback',
    '最後再把右側舞台換成 VRM / Live2D renderer',
  ]

  const modelLoadedCount = Number(Boolean(pythonHealth?.models_loaded?.tts)) + Number(Boolean(pythonHealth?.models_loaded?.stt))
  const activeVoiceInfo = voices.find((item) => item.name === voice)
  const speakerReady = Boolean(activeVoiceInfo?.speaker_ready)

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
                <SectionTitle icon={AudioLines} title="TTS / Voice settings" desc="管理 TTS 參考音檔與聲音設定，支援上傳新聲音和試聽。" />
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

                {/* Voice selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Active voice</Label>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onRefreshVoices} disabled={voicesLoading}>
                      <RefreshCw className={`size-3 ${voicesLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                  </div>
                  {voicesError && <div className="text-xs text-yellow-300">{voicesError}</div>}
                  <VoiceList voices={voices} active={voice} onSelect={onVoiceChange} onDelete={onDeleteVoice} onTrain={onTrainVoice} actionBusy={voiceActionBusy} />
                </div>

                {/* Upload new voice */}
                <VoiceUploadForm onUpload={onUploadVoice} />

                <div className="rounded-xl border border-border/70 bg-background/30 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Speaker cache</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {voice
                          ? speakerReady
                            ? `Voice "${voice}" 已建立 speaker，可直接產生語音。`
                            : `Voice "${voice}" 目前只有參考音檔，先按 Train speaker 建立 speaker。`
                          : '先選一個 voice。'}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => voice && void onTrainVoice(voice)}
                      disabled={!voice || speakerReady || voiceActionBusy}
                    >
                      {voiceActionBusy ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      Train speaker
                    </Button>
                  </div>
                </div>

                {/* TTS test */}
                <div className="space-y-2">
                  <Label htmlFor="ttsText">TTS test text</Label>
                  <Textarea id="ttsText" value={text} onChange={(e) => onTextChange(e.target.value)} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={onGenerateSpeech} disabled={!canGenerateSpeech || ttsTestStatus === 'generating'}>
                    {ttsTestStatus === 'generating'
                      ? <><Loader2 className="size-4 animate-spin" /> Generating...</>
                      : <><Sparkles className="size-4" /> Generate speech</>}
                  </Button>
                  {ttsTestStatus === 'ready' && (
                    <Button variant="outline" onClick={onPlayTestAudio}>
                      <Play className="size-4" /> Play
                    </Button>
                  )}
                  {ttsTestStatus === 'playing' && (
                    <Button variant="outline" onClick={onStopTestAudio}>
                      <Square className="size-4" /> Stop
                    </Button>
                  )}
                </div>
                {ttsTestStatus === 'error' && ttsTestError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{ttsTestError}</div>
                )}
                {!speakerReady && voice ? <div className="text-xs text-yellow-300">Generate speech 需要先完成 speaker training。</div> : null}
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
              <CardTitle className="flex items-center gap-2 text-xl"><Bot className="size-5 text-primary" /> OpenClaw dialogue</CardTitle>
              <CardDescription>把桌面聊天窗真的接進 OpenClaw Gateway。建議使用 `/v1/responses`，agent 預設為 `main`。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gatewayUrl">Gateway URL</Label>
                <Input id="gatewayUrl" value={gatewayUrl} onChange={(e) => onGatewayUrlChange(e.target.value)} placeholder="http://127.0.0.1:18789" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gatewayToken">Gateway token / password</Label>
                <Input id="gatewayToken" value={gatewayToken} onChange={(e) => onGatewayTokenChange(e.target.value)} placeholder="optional if local auth allows" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gatewayAgent">Agent ID</Label>
                <Input id="gatewayAgent" value={gatewayAgentId} onChange={(e) => onGatewayAgentIdChange(e.target.value)} placeholder="main" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gatewayUser">Session user key</Label>
                <Input id="gatewayUser" value={gatewayUser} onChange={(e) => onGatewayUserChange(e.target.value)} placeholder="virtual-avatar-desktop" />
              </div>
              <div className="flex items-center gap-3 md:col-span-2">
                <Button onClick={onTestGateway} disabled={gatewayTesting || !gatewayUrl.trim()} variant="outline">
                  <Cable className="size-4" /> {gatewayTesting ? 'Testing...' : 'Test connection'}
                </Button>
                {gatewayHealth && (
                  <span className={`text-sm ${gatewayHealth.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {gatewayHealth.ok
                      ? `Connected${gatewayHealth.data?.version ? ` (v${gatewayHealth.data.version})` : ''}`
                      : `Failed: ${gatewayHealth.message}`}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

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
