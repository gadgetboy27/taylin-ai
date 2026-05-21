import React, { useCallback, useEffect, useRef } from 'react'
import {
  View,
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
import { useVoice } from '@/context/VoiceContext'
import { MIN_TOUCH_TARGET } from '@/lib/accessibility'
import { floatShadow } from '@/lib/styles'

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

  const handleSpeechResult = useCallback(
    (text: string) => {
      onChange(text)
      setTimeout(() => onSubmit(text), 800)
    },
    [onChange, onSubmit]
  )

  const { partialResult, startListening, stopListening, isListening, isProcessing } =
    useSpeech(handleSpeechResult)

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

  const displayValue = isListening && partialResult ? partialResult : value
  const canSubmit = displayValue.trim().length > 0 && !isLoading && !isListening

  const styles = makeStyles(c)

  const inner = (
    <View style={styles.inner}>
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
            : placeholder ?? 'What do you need?'
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
          color={isListening || isWakeDetected ? '#fff' : c.micInactive}
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
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="arrow-up" size={20} color="#fff" />
        )}
      </Pressable>
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
