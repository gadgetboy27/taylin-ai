/**
 * Wake word detector — listens passively for "Taylin" on-device using Picovoice Porcupine.
 * No audio ever leaves the device until the wake word fires. Zero battery impact.
 *
 * ── SETUP (one-time) ────────────────────────────────────────────────────────
 * 1. Sign up free at https://console.picovoice.ai
 * 2. Copy your AccessKey → add to apps/mobile/.env:
 *      EXPO_PUBLIC_PICOVOICE_ACCESS_KEY=your_key_here
 * 3. Porcupine → Wake Words → Create → type "Taylin" → record ~20 samples
 * 4. Download the model files → rename and place at:
 *      apps/mobile/assets/wake-words/taylin_ios.ppn
 *      apps/mobile/assets/wake-words/taylin_android.ppn
 * 5. Build a dev client (Porcupine is native, does not run in Expo Go):
 *      npx expo run:ios   OR   npx expo run:android
 * ────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

export type WakeWordState = 'unavailable' | 'idle' | 'listening' | 'detected' | 'error'

const ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY ?? ''

export function useWakeWord(onDetected: () => void) {
  const [state, setState] = useState<WakeWordState>('unavailable')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const managerRef = useRef<any>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  const start = useCallback(async () => {
    if (Platform.OS === 'web') return
    if (!ACCESS_KEY) {
      console.warn('[wakeword] EXPO_PUBLIC_PICOVOICE_ACCESS_KEY not set — see hooks/useWakeWord.ts')
      setState('unavailable')
      return
    }

    try {
      // Dynamic import — gracefully absent in Expo Go or if module not yet installed
      const pv = await import('@picovoice/porcupine-react-native')
      const { PorcupineManager } = pv

      // Model paths — resolved from the app bundle after dev build
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modelPath = Platform.OS === 'ios'
        ? require('../assets/wake-words/taylin_ios.ppn')
        : require('../assets/wake-words/taylin_android.ppn')

      const manager = await PorcupineManager.fromKeywordPaths(
        ACCESS_KEY,
        [modelPath],
        () => {
          setState('detected')
          onDetectedRef.current()
          setTimeout(() => setState('listening'), 1500)
        },
        (err: Error) => {
          console.error('[wakeword] Porcupine error:', err)
          setState('error')
        },
      )

      managerRef.current = manager
      await manager.start()
      setState('listening')
    } catch (err) {
      // Expected in Expo Go — model files and native module only available in dev builds
      console.warn('[wakeword] Could not start wake word detection:', err)
      setState('unavailable')
    }
  }, [])

  const stop = useCallback(async () => {
    if (managerRef.current) {
      await managerRef.current.stop().catch(() => {})
      managerRef.current.delete()
      managerRef.current = null
    }
    setState('idle')
  }, [])

  useEffect(() => () => { stop() }, [stop])

  return { state, start, stop }
}
