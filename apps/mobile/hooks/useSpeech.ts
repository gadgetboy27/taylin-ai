import { useState, useCallback, useRef } from 'react'
import { Audio } from 'expo-av'
import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTTS } from './useTTS'
import { supabase } from '@/lib/supabase'

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

export type SpeechOptions = {
  /**
   * What to say back once a transcript arrives. Defaults to the search
   * phrasing; address capture and any other non-search caller passes its own
   * so the app doesn't announce "Searching for Wellington 6011".
   */
  confirmPhrase?: (transcript: string) => string
}

const isWeb = Platform.OS === 'web'

// Browsers disagree on container: Chrome/Firefox do webm/opus, Safari does mp4.
// Deepgram accepts all of these, and routes/voice.ts forwards whatever the blob
// declares as its Content-Type, so no server change is needed per format.
const WEB_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickWebMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return WEB_MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t))
}

export function useSpeech(onResult: (text: string) => void, options?: SpeechOptions) {
  const [state, setState] = useState<SpeechState>('idle')
  const [partialResult, setPartialResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const { speak } = useTTS()

  // Web capture state — MediaRecorder plus the stream, which must be stopped
  // explicitly or the browser leaves the tab's recording indicator lit.
  const webRecorderRef = useRef<MediaRecorder | null>(null)
  const webChunksRef = useRef<BlobPart[]>([])
  const webStreamRef = useRef<MediaStream | null>(null)

  // Held in a ref so callers can pass an inline arrow without re-creating
  // stopListening on every render.
  const confirmPhraseRef = useRef(options?.confirmPhrase)
  confirmPhraseRef.current = options?.confirmPhrase

  const releaseWebMic = useCallback(() => {
    webStreamRef.current?.getTracks().forEach((t) => t.stop())
    webStreamRef.current = null
    webRecorderRef.current = null
    webChunksRef.current = []
  }, [])

  // Shared tail of both platforms: upload, speak the confirmation, hand the
  // transcript to the caller.
  const transcribe = useCallback(async (formData: FormData) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${API_URL}/voice/transcribe`, {
      method: 'POST',
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: formData,
    })

    if (!res.ok) throw new Error(`Transcription request failed: ${res.status}`)

    const { transcript } = await res.json() as { transcript: string }

    if (!transcript?.trim()) {
      speak("Didn't catch that — try again", 'high')
      setError("Didn't catch that — try again")
      setState('error')
      return
    }

    setPartialResult(transcript)
    speak(confirmPhraseRef.current?.(transcript) ?? `Got it. Searching for ${transcript}`)
    onResult(transcript.trim())
    setState('idle')
    setPartialResult('')
  }, [onResult])

  const startListening = useCallback(async () => {
    if (isWeb) {
      try {
        setError(null)
        setPartialResult('')

        if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          setError('This browser cannot record audio')
          setState('error')
          return
        }

        // Prompts for mic permission on first use; rejects if denied or if the
        // page isn't on a secure origin (browsers require HTTPS or localhost).
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        webStreamRef.current = stream

        const mimeType = pickWebMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        webChunksRef.current = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) webChunksRef.current.push(e.data) }
        recorder.start()
        webRecorderRef.current = recorder

        setState('listening')
        speak('Listening')
      } catch (err) {
        releaseWebMic()
        const denied = err instanceof Error && /denied|NotAllowed/i.test(err.name + err.message)
        setError(denied ? 'Microphone permission denied' : 'Could not start recording')
        setState('error')
      }
      return
    }

    try {
      setError(null)
      setPartialResult('')

      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        setError('Microphone permission denied')
        setState('error')
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setState('listening')
      speak('Listening')

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start recording'
      setError(msg)
      setState('error')
    }
  }, [])

  const stopListening = useCallback(async () => {
    if (isWeb) {
      const recorder = webRecorderRef.current
      if (!recorder) return

      try {
        setState('processing')
        setPartialResult('Transcribing…')

        // MediaRecorder flushes its last chunk asynchronously, so the blob is
        // only complete once onstop has fired.
        const blob = await new Promise<Blob>((resolve) => {
          recorder.onstop = () => resolve(
            new Blob(webChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          )
          recorder.stop()
        })

        releaseWebMic()

        if (blob.size === 0) throw new Error('No audio recorded')

        const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        const formData = new FormData()
        formData.append('audio', blob, `voice.${ext}`)

        await transcribe(formData)
      } catch (err) {
        releaseWebMic()
        const msg = err instanceof Error ? err.message : 'Transcription failed'
        setError(msg)
        setState('error')
        speak('Voice search failed. Please try again or type your request.', 'high')
      }
      return
    }

    const recording = recordingRef.current
    if (!recording) return

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setState('processing')
      setPartialResult('Transcribing…')

      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      recordingRef.current = null

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })

      if (!uri) throw new Error('No audio recorded')

      // Build multipart form and POST to our backend → Deepgram
      const formData = new FormData()
      formData.append('audio', {
        uri,
        name: 'voice.m4a',
        type: 'audio/m4a',
      } as unknown as Blob)

      await transcribe(formData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      setError(msg)
      setState('error')
      speak('Voice search failed. Please try again or type your request.', 'high')
    }
  }, [transcribe, releaseWebMic])

  const cancelListening = useCallback(async () => {
    if (isWeb) {
      webRecorderRef.current?.stop()
      releaseWebMic()
    } else {
      const recording = recordingRef.current
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => {})
        recordingRef.current = null
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
      }
    }
    setState('idle')
    setPartialResult('')
    setError(null)
  }, [releaseWebMic])

  return {
    state,
    partialResult,
    error,
    startListening,
    stopListening,
    cancelListening,
    isListening: state === 'listening',
    isProcessing: state === 'processing',
  }
}
