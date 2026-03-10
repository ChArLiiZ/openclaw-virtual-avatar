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

export async function openClawRespond(cfg: OpenClawConfig, input: string): Promise<string> {
  if (!cfg.gatewayUrl.trim()) {
    throw new Error('OpenClaw gateway URL is empty')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-openclaw-agent-id': cfg.agentId || 'main',
  }

  if (cfg.token?.trim()) {
    headers.Authorization = `Bearer ${cfg.token.trim()}`
  }

  const res = await fetch(`${cfg.gatewayUrl.replace(/\/$/, '')}/v1/responses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'openclaw',
      input,
      user: cfg.user || 'virtual-avatar-desktop',
    }),
  })

  if (!res.ok) {
    const error = await parseJsonSafe(res)
    throw new Error(error?.error?.message || error?.error || error?.detail || `OpenClaw response failed: ${res.status}`)
  }

  const data = await res.json()
  const text = extractOutputText(data)
  if (!text) throw new Error('OpenClaw returned no assistant text')
  return text
}
