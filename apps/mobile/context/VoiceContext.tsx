/**
 * Global voice layer — wraps TTS + wake word detection so any screen can:
 *   const { speak, wakeWordCount, wakeWordState } = useVoice()
 *
 * wakeWordCount increments each time "Taylin" is heard.
 * Screens watch it with useEffect to auto-start recording.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useWakeWord, type WakeWordState } from '@/hooks/useWakeWord'

interface VoiceContextValue {
  /** Read a string aloud. priority='high' interrupts current speech. */
  speak: (text: string, priority?: 'high' | 'normal') => void
  stopSpeaking: () => void
  /** Increments every time the "Taylin" wake word fires. */
  wakeWordCount: number
  wakeWordState: WakeWordState
  startWakeWord: () => Promise<void>
  stopWakeWord: () => Promise<void>
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { speak, stop: stopSpeaking } = useTTS()
  const [wakeWordCount, setWakeWordCount] = useState(0)
  const countRef = useRef(0)

  const handleWakeWord = useCallback(() => {
    speak('Yes?', 'high')
    countRef.current += 1
    setWakeWordCount(countRef.current)
  }, [speak])

  const { state: wakeWordState, start: startWakeWord, stop: stopWakeWord } =
    useWakeWord(handleWakeWord)

  return (
    <VoiceContext.Provider value={{
      speak,
      stopSpeaking,
      wakeWordCount,
      wakeWordState,
      startWakeWord,
      stopWakeWord,
    }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used inside VoiceProvider')
  return ctx
}
