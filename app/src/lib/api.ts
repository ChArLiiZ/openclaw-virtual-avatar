export type HealthInfo = {
  status: string
  server?: string
  service?: string
  version?: string
  tts?: string
  model_idle_seconds?: number
  models_loaded?: {
    tts?: boolean
    stt?: boolean
  }
}

export type STTResult = {
  text: string
  language?: string
  duration?: number
}

export type OpenClawConfig = {
  gatewayUrl: string
  token?: string
  agentId?: string
  user?: string
}

async function parseJsonSafe(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()

  const outputs = Array.isArray(data?.output) ? data.output : []
  const parts: string[] = []

  for (const item of outputs) {
    if (typeof item?.text === 'string' && item.text.trim()) parts.push(item.text)
    const content = Array.isArray(item?.content) ? item.content : []
    for (const part of content) {
      if (typeof part?.text === 'string' && part.text.trim()) parts.push(part.text)
      if (typeof part?.output_text === 'string' && part.output_text.trim()) parts.push(part.output_text)
    }
  }

  if (parts.length) return parts.join('\n').trim()
  return ''
}

export async function fetchHealth(baseUrl: string): Promise<HealthInfo> {
  const res = await fetch(`${baseUrl}/health`)
  if (!res.ok) {
    throw new Error(`Health request failed: ${res.status}`)
  }
  return res.json()
}

export async function ttsRequest(baseUrl: string, payload: { input: string; voice: string; speed?: number; lang?: string }) {
  const res = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `TTS failed: ${res.status}`)
  }
  return res.blob()
}

export async function sttUpload(baseUrl: string, file: File, language?: string): Promise<STTResult> {
  const form = new FormData()
  form.append('audio', file)
  if (language) form.append('language', language)

  const res = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `STT failed: ${res.status}`)
  }
  return res.json()
}

export type VoiceInfo = {
  name: string
  ref_text?: string
  speaker_ready?: boolean
}

export async function fetchVoices(baseUrl: string): Promise<VoiceInfo[]> {
  const res = await fetch(`${baseUrl}/voices`)
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `Failed to list voices: ${res.status}`)
  }
  const data = await res.json()
  const voices = Array.isArray(data?.voices) ? data.voices : []
  return voices.map((voice: any) =>
    typeof voice === 'string'
      ? { name: voice, speaker_ready: false }
      : {
          name: String(voice?.name ?? ''),
          ref_text: typeof voice?.ref_text === 'string' ? voice.ref_text : undefined,
          speaker_ready: Boolean(voice?.speaker_ready),
        },
  ).filter((voice: VoiceInfo) => voice.name)
}

export async function uploadVoice(baseUrl: string, voiceName: string, audioFile: File, refText: string) {
  const form = new FormData()
  form.append('audio', audioFile)
  form.append('ref_text', refText)

  const res = await fetch(`${baseUrl}/voices/${encodeURIComponent(voiceName)}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `Failed to upload voice: ${res.status}`)
  }
  return res.json()
}

export async function deleteVoice(baseUrl: string, voiceName: string) {
  const res = await fetch(`${baseUrl}/voices/${encodeURIComponent(voiceName)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `Failed to delete voice: ${res.status}`)
  }
  return res.json()
}

export async function trainVoice(baseUrl: string, voiceName: string) {
  const res = await fetch(`${baseUrl}/voices/${encodeURIComponent(voiceName)}/train`, {
    method: 'POST',
  })
  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error || error?.detail || `Failed to train voice: ${res.status}`)
  }
  return res.json()
}

export type GatewayHealthResult = {
  ok: boolean
  status?: number
  message?: string
  data?: any
}

function gatewayHeaders(cfg: OpenClawConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-openclaw-agent-id': cfg.agentId || 'main',
  }
  if (cfg.token?.trim()) {
    headers.Authorization = `Bearer ${cfg.token.trim()}`
  }
  return headers
}

function gatewayBase(cfg: OpenClawConfig) {
  return cfg.gatewayUrl.replace(/\/$/, '')
}

export async function testGatewayConnection(cfg: OpenClawConfig): Promise<GatewayHealthResult> {
  if (!cfg.gatewayUrl.trim()) {
    return { ok: false, message: 'Gateway URL is empty' }
  }
  const url = `${gatewayBase(cfg)}/health`
  const headers = gatewayHeaders(cfg)
  console.log('[Gateway] Testing connection…', { url, headers: { ...headers, Authorization: headers.Authorization ? '***' : undefined } })
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await parseJsonSafe(res)
      console.log('[Gateway] Health OK', { status: res.status, data })
      return { ok: true, status: res.status, data }
    }
    const body = await parseJsonSafe(res)
    console.warn('[Gateway] Health responded with error', { status: res.status, body })
    return { ok: false, status: res.status, message: `HTTP ${res.status}` }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const isTimeout = raw.includes('AbortError') || raw.includes('timeout') || raw.includes('TimeoutError')
    const friendly = isTimeout
      ? 'Connection timed out (8s)'
      : raw === 'Failed to fetch'
        ? `無法連線 — 可能是 CORS、網路不通、或 URL 錯誤 (${url})`
        : raw
    console.error('[Gateway] Connection test failed', { url, error: raw, type: (err as any)?.constructor?.name })
    return { ok: false, message: friendly }
  }
}

export type OpenClawResponse = {
  text: string
  responseId?: string
}

export async function openClawRespond(cfg: OpenClawConfig, input: string, previousResponseId?: string): Promise<OpenClawResponse> {
  if (!cfg.gatewayUrl.trim()) {
    throw new Error('OpenClaw gateway URL is empty')
  }

  const url = `${gatewayBase(cfg)}/v1/responses`
  const body: Record<string, any> = {
    model: 'openclaw',
    input,
    user: cfg.user || 'virtual-avatar-desktop',
  }
  if (previousResponseId) {
    body.previous_response_id = previousResponseId
  }

  console.log('[Gateway] POST /v1/responses', { url, input: input.slice(0, 80), previousResponseId })

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: gatewayHeaders(cfg),
      body: JSON.stringify(body),
    })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error('[Gateway] /v1/responses fetch failed', { url, error: raw, type: (err as any)?.constructor?.name })
    throw new Error(`Gateway 連線失敗: ${raw === 'Failed to fetch' ? `無法連線 ${url} — CORS / 網路 / URL 錯誤` : raw}`)
  }

  if (!res.ok) {
    const error = await parseJsonSafe(res)
    console.error('[Gateway] /v1/responses error response', { status: res.status, error })
    throw new Error(error?.error?.message || error?.error || error?.detail || `OpenClaw response failed: ${res.status}`)
  }

  const data = await res.json()
  console.log('[Gateway] /v1/responses OK', { id: data?.id, outputKeys: Object.keys(data ?? {}) })
  const text = extractOutputText(data)
  if (!text) {
    console.warn('[Gateway] No assistant text extracted from response', data)
    throw new Error('OpenClaw returned no assistant text')
  }
  return { text, responseId: data?.id }
}
