import React, { useCallback, useRef } from 'react'
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type TextInput as TextInputType,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/context/ThemeContext'
import { useSpeech } from '@/hooks/useSpeech'
import { MIN_TOUCH_TARGET } from '@/lib/accessibility'

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

  return (
    <View style={styles.container}>
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

      {/* Mic button */}
      <Pressable
        style={[styles.iconBtn, isListening && { backgroundColor: c.micActive }]}
        onPress={handleMicPress}
        accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input'}
        accessibilityRole="button"
        accessibilityState={{ selected: isListening }}
        hitSlop={8}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={22}
          color={isListening ? '#fff' : c.micInactive}
        />
      </Pressable>

      {/* Submit button */}
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
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.promptBg,
      borderWidth: 1.5,
      borderColor: c.promptBorder,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      marginVertical: 12,
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
  })
}
