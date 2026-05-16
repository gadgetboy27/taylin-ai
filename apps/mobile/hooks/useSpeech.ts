import { useState, useCallback, useEffect } from 'react'
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition'
import { AccessibilityInfo } from 'react-native'
import * as Haptics from 'expo-haptics'

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error'

export function useSpeech(onResult: (text: string) => void) {
  const [state, setState] = useState<SpeechState>('idle')
  const [partialResult, setPartialResult] = useState('')
  const [error, setError] = useState<string | null>(null)

  useSpeechRecognitionEvent('start', () => {
    setState('listening')
    AccessibilityInfo.announceForAccessibility('Listening. Speak your request now.')
  })

  useSpeechRecognitionEvent('end', () => {
    setState((prev) => (prev === 'listening' ? 'processing' : prev))
  })

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? ''
    if (transcript) {
      setPartialResult(transcript)
      if (event.isFinal) {
        onResult(transcript)
        setState('idle')
        AccessibilityInfo.announceForAccessibility(`Heard: ${transcript}`)
      }
    }
  })

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.error ?? 'Speech recognition error')
    setState('error')
    AccessibilityInfo.announceForAccessibility(
      'Speech recognition failed. Please try again or type your request.'
    )
  })

  const startListening = useCallback(async () => {
    const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (status !== 'granted') {
      setError('Microphone permission denied')
      setState('error')
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setError(null)
    setPartialResult('')

    const options: ExpoSpeechRecognitionOptions = {
      lang: 'en-NZ',
      interimResults: true,
      continuous: false,
    }
    ExpoSpeechRecognitionModule.start(options)
  }, [])

  const stopListening = useCallback(async () => {
    ExpoSpeechRecognitionModule.stop()
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  return {
    state,
    partialResult,
    error,
    startListening,
    stopListening,
    isListening: state === 'listening',
    isProcessing: state === 'processing',
  }
}
