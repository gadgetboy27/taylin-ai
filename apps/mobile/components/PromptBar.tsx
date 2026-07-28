import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type TextInput as TextInputType,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { useSpeech } from '@/hooks/useSpeech'
import { VoiceWave } from '@/components/VoiceWave'
import { useVoice } from '@/context/VoiceContext'
import { MIN_TOUCH_TARGET } from '@/lib/accessibility'
import { floatShadow } from '@/lib/styles'

// Rotating suggestions teach what the agent can do without a tutorial — the
// hardest problem for a voice-first app is that a bare input tells you nothing
// about what it accepts.
const SUGGESTIONS = [
  'What do you need?',
  'Try: what\'s the weather tomorrow?',
  'Try: find me single origin coffee',
  'Try: merino base layer under $200',
  'Try: deals near me',
  'Try: what should I pay for a used Hilux?',
]

interface PromptBarProps {
  value: string
  onChange: (text: string) => void
  onSubmit: (text: string) => void
  isLoading?: boolean
  placeholder?: string
}

export function PromptBar({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder,
}: PromptBarProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const inputRef = useRef<TextInputType>(null)

  // Put the transcript in the input and stop there. This used to auto-submit
  // 800ms later, which gave the user no time to read or correct it — and once
  // onSubmit set isLoading, canSubmit went false, so the send button looked
  // broken rather than busy.
  const handleSpeechResult = useCallback(
    (text: string) => { onChange(text) },
    [onChange]
  )

  const {
    partialResult, startListening, stopListening,
    isListening, isProcessing, audioLevel, error: speechError,
  } = useSpeech(handleSpeechResult)

  // Auto-start recording when wake word "Taylin" fires
  const { wakeWordCount, wakeWordState } = useVoice()
  const prevWakeCount = useRef(0)
  useEffect(() => {
    if (wakeWordCount > prevWakeCount.current) {
      prevWakeCount.current = wakeWordCount
      if (!isListening) {
        inputRef.current?.blur()
        startListening()
      }
    }
  }, [wakeWordCount, isListening, startListening])

  const isWakeListening = wakeWordState === 'listening'
  const isWakeDetected  = wakeWordState === 'detected'

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      inputRef.current?.blur()
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Only rotates while the bar is idle: changing the hint under someone who is
  // mid-thought is a distraction, and it must never replace live feedback.
  const [hintIndex, setHintIndex] = useState(0)
  const idle = !isListening && !isProcessing && !isLoading && value.length === 0
  useEffect(() => {
    if (!idle) return
    const id = setInterval(() => setHintIndex((i) => (i + 1) % SUGGESTIONS.length), 4000)
    return () => clearInterval(id)
  }, [idle])

  const displayValue = isListening && partialResult ? partialResult : value
  const canSubmit = displayValue.trim().length > 0 && !isLoading && !isListening

  const styles = makeStyles(c)

  const row = (
    <View style={styles.inner}>
      {isListening && (
        <View style={styles.wave}>
          <VoiceWave level={audioLevel} active={isListening} />
        </View>
      )}

      <TextInput
        ref={inputRef}
        style={styles.input}
        value={displayValue}
        onChangeText={onChange}
        placeholder={
          isListening
            ? 'Listening...'
            : isProcessing
            ? 'Processing...'
            : placeholder ?? SUGGESTIONS[hintIndex]
        }
        placeholderTextColor={c.textMuted}
        onSubmitEditing={() => onSubmit(value)}
        returnKeyType="search"
        multiline={false}
        editable={!isListening && !isLoading}
        accessibilityLabel="Search prompt. Type your request here."
        accessibilityHint="Tap the microphone button to speak instead"
      />

      <Pressable
        style={[
          styles.iconBtn,
          isListening && { backgroundColor: c.micActive },
          isWakeDetected && { backgroundColor: c.primary },
        ]}
        onPress={handleMicPress}
        accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input. Or say Taylin to activate hands-free.'}
        accessibilityRole="button"
        accessibilityState={{ selected: isListening }}
        hitSlop={8}
      >
        <Ionicons
          name={isListening || isWakeDetected ? 'mic' : 'mic-outline'}
          size={22}
          color={isListening || isWakeDetected ? c.textOnPrimary : c.micInactive}
        />
        {/* Wake word active dot — shows when Porcupine is passively listening */}
        {isWakeListening && !isListening && (
          <View style={styles.wakeWordDot} />
        )}
      </Pressable>

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={() => onSubmit(value)}
        disabled={!canSubmit}
        accessibilityLabel="Search now"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        hitSlop={4}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={c.textOnPrimary} />
        ) : (
          <Ionicons name="arrow-up" size={20} color={c.textOnPrimary} />
        )}
      </Pressable>
    </View>
  )

  // Speech failures were invisible here: useSpeech's `error` was never
  // destructured, so "Didn't catch that" left a disabled send button and no
  // explanation on screen.
  const inner = (
    <View style={styles.stack}>
      {row}
      {speechError && !isListening && (
        <Text style={styles.speechError}>{speechError}</Text>
      )}
    </View>
  )

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={68}
        tint={c.glassTint}
        style={styles.container}
      >
        {inner}
      </BlurView>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.promptBg }]}>
      {inner}
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    container: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.glassBorder,
      overflow: 'hidden',
      ...floatShadow,
    },
    stack: { flexDirection: 'column' },
    speechError: {
      fontSize: 12,
      color: c.error,
      paddingHorizontal: 16,
      paddingBottom: 10,
      marginTop: -4,
    },
    wave: { justifyContent: 'center' },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.glassBackground,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: c.text,
      paddingVertical: 0,
      minHeight: MIN_TOUCH_TARGET,
    },
    iconBtn: {
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
      borderRadius: MIN_TOUCH_TARGET / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: {
      opacity: 0.35,
    },
    wakeWordDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#22c55e', // green — always listening
    },
  })
}
