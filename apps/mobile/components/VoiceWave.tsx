import React, { useEffect, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'

// Kept narrow: this sits inline in the prompt bar's flex row, so every bar
// takes width away from the text input.
const BARS = 14
const MIN_HEIGHT = 3
const MAX_HEIGHT = 20

/**
 * Scrolling amplitude meter for live mic input.
 *
 * A rolling history rather than a static level bar on purpose: it keeps moving
 * while you speak, so silence reads as "not hearing you" rather than "frozen".
 * That distinction is the whole point — without it there's no way to tell a
 * dead mic from a working one until the transcript comes back empty.
 */
export function VoiceWave({ level, active }: { level: number; active: boolean }) {
  const { theme } = useTheme()
  const c = theme.colors
  const [history, setHistory] = useState<number[]>(() => new Array(BARS).fill(0))
  const lastLevel = useRef(0)

  lastLevel.current = level

  useEffect(() => {
    if (!active) {
      setHistory(new Array(BARS).fill(0))
      return
    }
    // Sampled on a timer rather than driven by `level` changes so the wave
    // keeps scrolling during silence instead of stalling on a flat value.
    const id = setInterval(() => {
      setHistory((h) => [...h.slice(1), lastLevel.current])
    }, 60)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {history.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: MIN_HEIGHT + v * (MAX_HEIGHT - MIN_HEIGHT),
              backgroundColor: c.primary,
              // Older samples fade out, giving the scroll a direction.
              opacity: 0.25 + (i / BARS) * 0.75,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: MAX_HEIGHT,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
})
