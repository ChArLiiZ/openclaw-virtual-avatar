import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AvatarView } from '@/views/AvatarView'
import { ChatView } from '@/views/ChatView'
import { RecordView } from '@/views/RecordView'
import { SettingsView } from '@/views/SettingsView'
import type { AvatarState, ChatMessage, ViewMode } from '@/types'
import { deleteVoice, fetchHealth, fetchVoices, openClawRespond, sttUpload, testGatewayConnection, trainVoice, ttsRequest, uploadVoice, type GatewayHealthResult, type HealthInfo, type VoiceInfo } from '@/lib/api'
import { currentWindowKind, hideAndFocusChat, hideCurrentWindow, showWindow } from '@/lib/windows'
import { publishSttResult, sendChatMessage, setSharedDraft, subscribeBridge } from '@/lib/bridge'
import { useMediaRecorder } from '@/lib/useMediaRecorder'

function usePersistedState<T extends string>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try { return (localStorage.getItem(key) as T) ?? defaultValue } catch { return defaultValue }
  })
  const set = useCallback((v: T) => {
    setValue(v)
    try { localStorage.setItem(key, v) } catch { /* ignore */ }
  }, [key])
  return [value, set]
}

export default function App() {
  const initialView = useMemo<ViewMode>(() => currentWindowKind(), [])
  const [view] = useState<ViewMode>(initialView)
  const [avatarState, setAvatarState] = useState<AvatarState>('idle')
  const [serverUrl, setServerUrl] = usePersistedState('oc:serverUrl', 'http://100.113.172.86:8080')
  const [pythonUrl, setPythonUrl] = usePersistedState('oc:pythonUrl', 'http://100.113.172.86:8081')
  const [gatewayUrl, setGatewayUrl] = usePersistedState('oc:gatewayUrl', '')
  const [gatewayToken, setGatewayToken] = usePersistedState('oc:gatewayToken', '')
  const [gatewayAgentId, setGatewayAgentId] = usePersistedState('oc:gatewayAgentId', 'main')
  const [gatewayUser, setGatewayUser] = usePersistedState('oc:gatewayUser', 'virtual-avatar-desktop')
  const [voice, setVoice] = usePersistedState('oc:voice', 'vivian')
  const [ttsText, setTtsText] = useState('您好，我是薇薇安。這裡之後會是桌面角色的設定中心。')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [nodeHealth, setNodeHealth] = useState<HealthInfo | null>(null)
  const [pythonHealth, setPythonHealth] = useState<HealthInfo | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesError, setVoicesError] = useState<string | null>(null)
  const [voiceActionBusy, setVoiceActionBusy] = useState(false)
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealthResult | null>(null)
  const [gatewayTesting, setGatewayTesting] = useState(false)
  const [ttsTestStatus, setTtsTestStatus] = useState<'idle' | 'generating' | 'ready' | 'playing' | 'error'>('idle')
  const [ttsTestError, setTtsTestError] = useState<string | null>(null)
  const [ttsTestAudioUrl, setTtsTestAudioUrl] = useState<string | null>(null)
  const ttsTestAudioRef = useRef<HTMLAudioElement | null>(null)
  const previousResponseId = useRef<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '早安。接下來會改成真正的多視窗桌面角色。' },
    { role: 'assistant', text: '這裡會保留簡單對話，不塞太多工程控制。' },
  ])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mic = useMediaRecorder()

  const appendMessage = (message: ChatMessage, sync = true) => {
    setMessages((prev) => [...prev, message])
    if (sync) sendChatMessage(message)
  }

  useEffect(() => {
    const stop = subscribeBridge((event) => {
      if (event.type === 'chat-message') {
        setMessages((prev) => [...prev, event.message])
      }
      if (event.type === 'draft-set' || event.type === 'stt-result') {
        setDraft(event.text)
      }
    })
    return stop
  }, [])

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

  async function refreshVoices() {
    setVoicesLoading(true)
    setVoicesError(null)
    try {
      const list = await fetchVoices(serverUrl)
      setVoices(list)
    } catch (error) {
      setVoicesError(error instanceof Error ? error.message : String(error))
    } finally {
      setVoicesLoading(false)
    }
  }

  async function handleUploadVoice(name: string, audioFile: File, refText: string) {
    await uploadVoice(serverUrl, name, audioFile, refText)
    await refreshVoices()
    setVoice(name)
  }

  async function handleDeleteVoice(name: string) {
    await deleteVoice(serverUrl, name)
    await refreshVoices()
    if (voice === name) {
      setVoice('')
    }
  }

  async function handleTrainVoice(name: string) {
    setVoiceActionBusy(true)
    try {
      await trainVoice(serverUrl, name)
      await refreshVoices()
      setVoice(name)
    } finally {
      setVoiceActionBusy(false)
    }
  }

  const activeVoiceInfo = voices.find((item) => item.name === voice)
  const canGenerateSpeech = Boolean(voice && activeVoiceInfo?.speaker_ready && !voiceActionBusy)

  useEffect(() => {
    if (view === 'settings') {
      void refreshHealth()
      void refreshVoices()
    }
  }, [serverUrl, pythonUrl, view])

  // Auto-retry polling: when services aren't reachable yet, retry every 5s
  useEffect(() => {
    if (view !== 'settings') return
    const hasHealth = nodeHealth || pythonHealth
    const hasVoices = voices.length > 0
    if (hasHealth && hasVoices) return // already connected

    const timer = setInterval(() => {
      void refreshHealth()
      void refreshVoices()
    }, 5000)
    return () => clearInterval(timer)
  }, [view, nodeHealth, pythonHealth, voices.length])

  async function handleTestGateway() {
    setGatewayTesting(true)
    setGatewayHealth(null)
    try {
      const result = await testGatewayConnection({ gatewayUrl, token: gatewayToken, agentId: gatewayAgentId, user: gatewayUser })
      setGatewayHealth(result)
    } finally {
      setGatewayTesting(false)
    }
  }

  async function handleTestSpeech() {
    if (!ttsText.trim() || ttsTestStatus === 'generating') return
    // Clean up previous test audio
    if (ttsTestAudioUrl) URL.revokeObjectURL(ttsTestAudioUrl)
    setTtsTestAudioUrl(null)
    setTtsTestError(null)
    setTtsTestStatus('generating')
    try {
      const blob = await ttsRequest(serverUrl, { input: ttsText, voice, lang: 'zh' })
      const url = URL.createObjectURL(blob)
      setTtsTestAudioUrl(url)
      setTtsTestStatus('ready')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[TTS Test]', message)
      setTtsTestError(message)
      setTtsTestStatus('error')
    }
  }

  function handlePlayTestAudio() {
    if (!ttsTestAudioUrl) return
    if (!ttsTestAudioRef.current) {
      ttsTestAudioRef.current = new Audio()
      ttsTestAudioRef.current.addEventListener('ended', () => setTtsTestStatus('ready'))
      ttsTestAudioRef.current.addEventListener('error', () => {
        setTtsTestStatus('error')
        setTtsTestError('Audio playback failed')
      })
    }
    ttsTestAudioRef.current.src = ttsTestAudioUrl
    setTtsTestStatus('playing')
    ttsTestAudioRef.current.play().catch(() => {
      setTtsTestStatus('error')
      setTtsTestError('Audio playback failed')
    })
  }

  function handleStopTestAudio() {
    if (ttsTestAudioRef.current) {
      ttsTestAudioRef.current.pause()
      ttsTestAudioRef.current.currentTime = 0
    }
    setTtsTestStatus('ready')
  }

  async function playBlob(blob: Blob) {
    if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl)
    const url = URL.createObjectURL(blob)
    setCurrentAudioUrl(url)
    if (audioRef.current) {
      audioRef.current.src = url
      setAvatarState('speaking')
      await audioRef.current.play()
    }
  }

  async function synthesizeAssistant(text: string) {
    const blob = await ttsRequest(serverUrl, { input: text, voice, lang: 'zh' })
    await playBlob(blob)
  }

  async function handleSend(sourceText?: string) {
    const text = (sourceText ?? draft).trim()
    if (!text || busy) return

    appendMessage({ role: 'user', text })
    setBusy(true)
    setAvatarState('thinking')

    try {
      let assistantText: string
      if (gatewayUrl.trim()) {
        const resp = await openClawRespond(
          { gatewayUrl, token: gatewayToken, agentId: gatewayAgentId, user: gatewayUser },
          text,
          previousResponseId.current,
        )
        assistantText = resp.text
        previousResponseId.current = resp.responseId
      } else {
        assistantText = text
      }

      appendMessage({ role: 'assistant', text: assistantText })
      await synthesizeAssistant(assistantText)

      if (!sourceText) {
        setDraft('')
        setSharedDraft('')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAvatarState('error')
      appendMessage({ role: 'system', text: `Dialogue failed: ${message}` })
    } finally {
      setBusy(false)
    }
  }

  async function handleAudioFile(file: File) {
    setBusy(true)
    setAvatarState('listening')
    try {
      const result = await sttUpload(serverUrl, file, 'zh')
      const text = result.text || ''
      setDraft(text)
      setSharedDraft(text)
      publishSttResult(text)
      appendMessage({ role: 'user', text: text || '(empty STT result)' })
      setAvatarState('idle')
      if (view === 'record') {
        await hideAndFocusChat()
      } else {
        await showWindow('chat')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAvatarState('error')
      appendMessage({ role: 'system', text: `STT failed: ${message}` })
      if (view === 'record') {
        await hideAndFocusChat()
      } else {
        await showWindow('chat')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleMicStop() {
    const file = await mic.stopRecording()
    if (file) await handleAudioFile(file)
  }

  /** Avatar recording: STT → auto-send to dialogue (no draft step) */
  async function handleAutoSend(file: File) {
    setBusy(true)
    setAvatarState('listening')
    try {
      const result = await sttUpload(serverUrl, file, 'zh')
      const text = (result.text || '').trim()
      if (!text) {
        setAvatarState('idle')
        return
      }
      // Show chat and auto-send the transcribed text
      await showWindow('chat')
      await handleSend(text)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAvatarState('error')
      appendMessage({ role: 'system', text: `STT failed: ${message}` })
      await showWindow('chat')
    } finally {
      setBusy(false)
    }
  }

  /** Toggle recording from avatar: start or stop + auto-send */
  async function toggleAvatarRecording() {
    if (mic.status === 'recording') {
      const file = await mic.stopRecording()
      if (file) await handleAutoSend(file)
    } else if (mic.status === 'idle') {
      await mic.startRecording()
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

  function updateDraft(value: string) {
    setDraft(value)
    setSharedDraft(value)
  }

  if (view === 'avatar') {
    return (
      <AvatarView
        state={avatarState}
        recordingStatus={mic.status}
        recordingDuration={mic.duration}
        onOpenChat={() => void showWindow('chat')}
        onToggleRecording={() => void toggleAvatarRecording()}
        onCancelRecording={mic.cancelRecording}
        onOpenSettings={() => void showWindow('settings')}
      />
    )
  }

  if (view === 'record') {
    return (
      <>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" />
        <RecordView
          state={avatarState}
          busy={busy}
          recordingStatus={mic.status}
          recordingDuration={mic.duration}
          onPickAudio={() => fileInputRef.current?.click()}
          onStartRecording={() => void mic.startRecording()}
          onStopRecording={() => void handleMicStop()}
          onCancelRecording={mic.cancelRecording}
          onClose={() => void hideCurrentWindow()}
        />
      </>
    )
  }

  if (view === 'chat') {
    return (
      <ChatView
        state={avatarState}
        draft={draft}
        messages={messages}
        busy={busy}
        onDraftChange={updateDraft}
        onOpenSettings={() => void showWindow('settings')}
        onSend={() => void handleSend()}
        onClose={() => void hideCurrentWindow()}
      />
    )
  }

  return (
    <SettingsView
      serverUrl={serverUrl}
      pythonUrl={pythonUrl}
      gatewayUrl={gatewayUrl}
      gatewayToken={gatewayToken}
      gatewayAgentId={gatewayAgentId}
      gatewayUser={gatewayUser}
      voice={voice}
      voices={voices}
      voicesLoading={voicesLoading}
      voicesError={voicesError}
      text={ttsText}
      transcript={draft}
      avatarState={avatarState}
      nodeHealth={nodeHealth}
      pythonHealth={pythonHealth}
      loadingHealth={loadingHealth}
      healthError={healthError}
      onRefreshHealth={() => void refreshHealth()}
      onRefreshVoices={() => void refreshVoices()}
      onServerUrlChange={setServerUrl}
      onPythonUrlChange={setPythonUrl}
      onGatewayUrlChange={setGatewayUrl}
      onGatewayTokenChange={setGatewayToken}
      onGatewayAgentIdChange={setGatewayAgentId}
      onGatewayUserChange={setGatewayUser}
      onVoiceChange={setVoice}
      onUploadVoice={handleUploadVoice}
      onDeleteVoice={handleDeleteVoice}
      onTrainVoice={handleTrainVoice}
      onTextChange={setTtsText}
      onTranscriptChange={updateDraft}
      canGenerateSpeech={canGenerateSpeech}
      voiceActionBusy={voiceActionBusy}
      onGenerateSpeech={() => void handleTestSpeech()}
      ttsTestStatus={ttsTestStatus}
      ttsTestError={ttsTestError}
      onPlayTestAudio={handlePlayTestAudio}
      onStopTestAudio={handleStopTestAudio}
      gatewayHealth={gatewayHealth}
      gatewayTesting={gatewayTesting}
      onTestGateway={() => void handleTestGateway()}
    />
  )
}
