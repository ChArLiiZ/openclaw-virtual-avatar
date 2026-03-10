import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordingStatus } from '@/types'

export interface UseMediaRecorderReturn {
  status: RecordingStatus
  duration: number
  startRecording: () => Promise<void>
  stopRecording: () => Promise<File | null>
  cancelRecording: () => void
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const resolveRef = useRef<((file: File | null) => void) | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    clearTimer()
    releaseStream()
    mediaRecorderRef.current = null
    chunksRef.current = []
    setDuration(0)
  }, [clearTimer, releaseStream])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  const startRecording = useCallback(async () => {
    if (status === 'recording') return

    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        clearTimer()
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        releaseStream()
        setStatus('idle')
        if (resolveRef.current) {
          resolveRef.current(file)
          resolveRef.current = null
        }
      }

      recorder.start(250) // collect data every 250ms
      startTimeRef.current = Date.now()
      setStatus('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 200)
    } catch (error) {
      cleanup()
      setStatus('idle')
      console.error('[useMediaRecorder] failed to start recording', error)
      throw error
    }
  }, [status, clearTimer, releaseStream, cleanup])

  const stopRecording = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state !== 'recording') {
        cleanup()
        setStatus('idle')
        resolve(null)
        return
      }

      resolveRef.current = resolve
      setStatus('processing')
      recorder.stop()
    })
  }, [cleanup])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null // prevent resolve
      recorder.stop()
    }
    if (resolveRef.current) {
      resolveRef.current(null)
      resolveRef.current = null
    }
    cleanup()
    setStatus('idle')
  }, [cleanup])

  return { status, duration, startRecording, stopRecording, cancelRecording }
}
