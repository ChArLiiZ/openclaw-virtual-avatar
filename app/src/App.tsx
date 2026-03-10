import { useMemo, useState } from 'react'
import { AudioLines, Mic, Play, RefreshCw, SendHorizonal, Sparkles, Waves, Box, Bot, Cable, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://100.113.172.86:8080')
  const [pythonUrl, setPythonUrl] = useState('http://100.113.172.86:8081')
  const [voice, setVoice] = useState('vivian')
  const [text, setText] = useState('您好，我是薇薇安。這裡是虛擬角色桌面控制台的第一版。')
  const [transcript, setTranscript] = useState('')

  const roadmap = useMemo(
    () => [
      '先做 status / TTS / STT 的可用控制台',
      '接上 Tauri v2 外殼與本地設定檔',
      '加入麥克風錄音與串流轉錄',
      '補上聊天歷史與角色狀態欄',
      '在右側 Avatar Stage 換成 Live2D / VRM renderer',
    ],
    [],
  )

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-border/70 bg-card/70 p-6 shadow-glow backdrop-blur md:flex-row md:items-center">
        <div className="space-y-3">
          <Badge variant="secondary" className="w-fit">AIRI-style desktop target · Tauri-ready shell</Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Virtual Avatar Console</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              先把桌面操作台做起來：能看狀態、按麥克風、打字說話，右側預留 Avatar Stage，之後再接 Live2D / VRM。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary"><RefreshCw className="size-4" /> Refresh status</Button>
          <Button><Box className="size-4" /> Open Tauri shell later</Button>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Cable className="size-5 text-primary" /> Service status</CardTitle>
              <CardDescription>這裡之後會接真實 health API。現在先把資訊面板與資料形狀定下來。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Node proxy</span><StatusDot ok={true} /></div>
                <div className="mt-3 font-medium">online</div>
                <div className="mt-1 text-xs text-muted-foreground">{serverUrl}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Python service</span><StatusDot ok={true} /></div>
                <div className="mt-3 font-medium">online</div>
                <div className="mt-1 text-xs text-muted-foreground">{pythonUrl}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Models</span><StatusDot ok={true} /></div>
                <div className="mt-3 font-medium">TTS loaded · STT warm</div>
                <div className="mt-1 text-xs text-muted-foreground">idle unload: 300s</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionTitle icon={AudioLines} title="TTS Console" desc="輸入文字、選 voice，之後直接打 media-server 的 /v1/audio/speech。" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">Node proxy URL</Label>
                  <Input id="serverUrl" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voice">Voice</Label>
                  <Input id="voice" value={voice} onChange={(e) => setVoice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ttsText">Text</Label>
                  <Textarea id="ttsText" value={text} onChange={(e) => setText(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button><Sparkles className="size-4" /> Generate speech</Button>
                  <Button variant="secondary"><Play className="size-4" /> Play result</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionTitle icon={Mic} title="Speech input" desc="首版先保留兩條路：按麥克風說話、或直接打字跟角色互動。" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-24 flex-col"><Mic className="size-6" /> Hold to talk</Button>
                  <Button variant="secondary" className="h-24 flex-col"><Waves className="size-6" /> Upload audio</Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transcript">Transcript / user input</Label>
                  <Textarea
                    id="transcript"
                    placeholder="之後麥克風辨識結果會出現在這裡；現在也可以直接當文字輸入框。"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button><SendHorizonal className="size-4" /> Send to avatar</Button>
                  <Button variant="outline"><Bot className="size-4" /> Route to OpenClaw later</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Settings2 className="size-5 text-primary" /> Build path</CardTitle>
              <CardDescription>這一版先把結構定住，之後就能往 AIRI 那種桌面互動感推進。</CardDescription>
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
              <CardTitle className="text-xl">Avatar Stage</CardTitle>
              <CardDescription>右側先保留一個 AIRI-style 舞台區。下一步會替換成 VRM / Live2D renderer。</CardDescription>
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
                      <p className="text-lg font-semibold">VRM / Live2D placeholder</p>
                      <p className="mt-2 text-sm text-muted-foreground">未來這裡會放角色本體、表情、口型、待機動畫。</p>
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
