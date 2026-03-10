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

async function parseJsonSafe(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
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
