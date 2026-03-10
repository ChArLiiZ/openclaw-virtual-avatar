import { useEffect, useRef, useState } from 'react'
import { LayoutPanelTop, MessageCircle, Mic, Settings2 } from 'lucide-react'
import { AvatarView } from '@/views/AvatarView'
import { ChatView } from '@/views/ChatView'
import { SettingsView } from '@/views/SettingsView'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AvatarState, ChatMessage, ViewMode } from '@/types'
import { fetchHealth, sttUpload, ttsRequest, type HealthInfo } from '@/lib/api'

export default function App() {
  const [view, setView] = useState<ViewMode>('avatar')
  const [avatarState, setAvatarState] = useState<AvatarState>('idle')
  const [serverUrl, setServerUrl] = useState('http://100.113.172.86:8080')
  const [pythonUrl, setPythonUrl] = useState('http://100.113.172.86:8081')
  const [voice, setVoice] = useState('vivian')
  const [ttsText, setTtsText] = useState('您好，我是薇薇安。這裡之後會是桌面角色的設定中心。')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [nodeHealth, setNodeHealth] = useState<HealthInfo | null>(null)
  const [pythonHealth, setPythonHealth] = useState<HealthInfo | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [currentAudioLabel, setCurrentAudioLabel] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '早安。現在已經拆成 Avatar / Chat / Settings 三個視圖了。' },
    { role: 'assistant', text: '下一步是把這條互動回路接到真實 TTS / STT。' },
  ])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const appendMessage = (message: ChatMessage) => setMessages((prev) => [...prev, message])

  useEffect(() => {
    audioRef.current = new Audio()
    const audio = audioRef.current
    const onEnded = () => setAvatarState('idle')
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.pause()
      audio.removeEventListener('ended', onEnded)
      if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl)
    }
  }, [])

  async function refreshHealth() {
    setLoadingHealth(true)
    setHealthError(null)
    try {
      const [node, python] = await Promise.all([fetchHealth(serverUrl), fetchHealth(pythonUrl)])
      setNodeHealth(node)
      setPythonHealth(python)
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    void refreshHealth()
  }, [serverUrl, pythonUrl])

  const openChat = () => setView('chat')
  const openSettings = () => setView('settings')
  const startVoice = () => {
    setAvatarState('listening')
    setView('chat')
    fileInputRef.current?.click()
  }

  async function playBlob(blob: Blob, label: string) {
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl)
    const url = URL.createObjectURL(blob)
    setCurrentAudioUrl(url)
    setCurrentAudioLabel(label)
    if (audioRef.current) {
      audioRef.current.src = url
      setAvatarState('speaking')
      await audioRef.current.play()
    }
  }

  async function handleSend(sourceText?: string) {
    const text = (sourceText ?? draft).trim()
    if (!text || busy) return

    appendMessage({ role: 'user', text })
    setBusy(true)
    setAvatarState('thinking')
    try {
      const blob = await ttsRequest(serverUrl, { input: text, voice, lang: 'zh' })
      appendMessage({ role: 'assistant', text: `已生成語音：${text}` })
      await playBlob(blob, `tts-${Date.now()}.wav`)
      if (!sourceText) setDraft('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAvatarState('error')
      appendMessage({ role: 'system', text: `TTS failed: ${message}` })
    } finally {
      setBusy(false)
    }
  }

  async function handleAudioFile(file: File) {
    setBusy(true)
    setAvatarState('listening')
    try {
      const result = await sttUpload(serverUrl, file, 'zh')
      setDraft(result.text)
      appendMessage({ role: 'system', text: `STT: ${result.text || '(empty result)'}` })
      setAvatarState('idle')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAvatarState('error')
      appendMessage({ role: 'system', text: `STT failed: ${message}` })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const input = fileInputRef.current
    if (!input) return
    const onChange = async () => {
      const file = input.files?.[0]
      if (file) await handleAudioFile(file)
      input.value = ''
    }
    input.addEventListener('change', onChange)
    return () => input.removeEventListener('change', onChange)
  }, [serverUrl])

  async function replayAudio() {
    if (!audioRef.current || !currentAudioUrl) return
    audioRef.current.currentTime = 0
    setAvatarState('speaking')
    await audioRef.current.play()
  }

  return (
    <div className="relative min-h-screen">
      <nav className="fixed left-1/2 top-5 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-background/80 p-2 shadow-glow backdrop-blur-xl">
        <Badge variant="secondary" className="hidden sm:inline-flex">Phase 1-4 prototype</Badge>
        <Button size="sm" variant={view === 'avatar' ? 'default' : 'ghost'} onClick={() => setView('avatar')}>
          <LayoutPanelTop className="size-4" /> Avatar
        </Button>
        <Button size="sm" variant={view === 'chat' ? 'default' : 'ghost'} onClick={() => setView('chat')}>
          <MessageCircle className="size-4" /> Chat
        </Button>
        <Button size="sm" variant={view === 'settings' ? 'default' : 'ghost'} onClick={() => setView('settings')}>
          <Settings2 className="size-4" /> Settings
        </Button>
        <Button size="sm" variant="outline" onClick={startVoice} disabled={busy}>
          <Mic className="size-4" /> Voice
        </Button>
      </nav>

      {view === 'avatar' && (
        <AvatarView state={avatarState} onOpenChat={openChat} onStartVoice={startVoice} onOpenSettings={openSettings} />
      )}

      {view === 'chat' && (
        <ChatView
          state={avatarState}
          draft={draft}
          messages={messages}
          busy={busy}
          currentAudioLabel={currentAudioLabel}
          onDraftChange={setDraft}
          onOpenSettings={openSettings}
          onSend={() => void handleSend()}
          onPickAudio={() => fileInputRef.current?.click()}
          onReplay={() => void replayAudio()}
          fileInputRef={fileInputRef}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          serverUrl={serverUrl}
          pythonUrl={pythonUrl}
          voice={voice}
          text={ttsText}
          transcript={draft}
          avatarState={avatarState}
          nodeHealth={nodeHealth}
          pythonHealth={pythonHealth}
          loadingHealth={loadingHealth}
          healthError={healthError}
          onRefreshHealth={() => void refreshHealth()}
          onServerUrlChange={setServerUrl}
          onPythonUrlChange={setPythonUrl}
          onVoiceChange={setVoice}
          onTextChange={setTtsText}
          onTranscriptChange={setDraft}
          onGenerateSpeech={() => void handleSend(ttsText)}
        />
      )}
    </div>
  )
}
