import { useState, useCallback, useRef } from 'react'
import { Audio } from 'expo-av'
import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTTS } from './useTTS'
import { supabase } from '@/lib/supabase'

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

export function useSpeech(onResult: (text: string) => void) {
  const [state, setState] = useState<SpeechState>('idle')
  const [partialResult, setPartialResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recordingRef = useRef<Audio.Recording | null>(null)
  const { speak } = useTTS()

  const startListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      setError('Voice input is not supported in the browser')
      setState('error')
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

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/voice/transcribe`, {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      })

      if (!res.ok) throw new Error(`Transcription request failed: ${res.status}`)

      const { transcript } = await res.json() as { transcript: string }

      if (transcript?.trim()) {
        setPartialResult(transcript)
        speak(`Got it. Searching for ${transcript}`)
        onResult(transcript.trim())
      } else {
        speak("Didn't catch that — try again", 'high')
        setError("Didn't catch that — try again")
        setState('error')
        return
      }

      setState('idle')
      setPartialResult('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed'
      setError(msg)
      setState('error')
      speak('Voice search failed. Please try again or type your request.', 'high')
    }
  }, [onResult])

  const cancelListening = useCallback(async () => {
    const recording = recordingRef.current
    if (recording) {
      await recording.stopAndUnloadAsync().catch(() => {})
      recordingRef.current = null
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })
    }
    setState('idle')
    setPartialResult('')
    setError(null)
  }, [])

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
