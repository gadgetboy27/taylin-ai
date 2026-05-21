import * as Speech from 'expo-speech'
import { useCallback, useRef } from 'react'
import { Platform } from 'react-native'

// Wraps expo-speech with a priority queue so announcements don't talk over each other.
// Priority 'high' (errors, wake-word confirm) interrupts whatever is playing.
// Priority 'normal' waits its turn.

export function useTTS() {
  const queue = useRef<string[]>([])
  const busy = useRef(false)

  const drain = useCallback(() => {
    if (busy.current || queue.current.length === 0) return
    if (Platform.OS === 'web') return
    const text = queue.current.shift()!
    busy.current = true
    Speech.speak(text, {
      language: 'en-NZ',
      rate: 1.05,
      onDone:  () => { busy.current = false; drain() },
      onError: () => { busy.current = false; drain() },
    })
  }, [])

  const speak = useCallback((text: string, priority: 'high' | 'normal' = 'normal') => {
    if (Platform.OS === 'web') return
    if (priority === 'high') {
      Speech.stop()
      queue.current = [text]
      busy.current = false
    } else {
      queue.current.push(text)
    }
    drain()
  }, [drain])

  const stop = useCallback(() => {
    Speech.stop()
    queue.current = []
    busy.current = false
  }, [])

  return { speak, stop }
}
