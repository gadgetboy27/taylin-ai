import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { ChatBubble, TypingIndicator } from '@/components/ChatBubble'
import { startInterview, sendMessage, type InterviewMessage } from '@/lib/seller-api'
import { floatShadow } from '@/lib/styles'

type UIItem =
  | { key: string; type: 'message'; message: InterviewMessage }
  | { key: string; type: 'typing' }

export default function SellerApplyScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InterviewMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [completionTier, setCompletionTier] = useState<1 | 2 | 3 | null>(null)
  const [completionSummary, setCompletionSummary] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const listRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    let cancelled = false
    setIsTyping(true)
    setInitError(null)

    startInterview()
      .then((data) => {
        if (cancelled) return
        setApplicationId(data.applicationId)
        setMessages(data.conversation)
        setIsTyping(false)
      })
      .catch(() => {
        if (cancelled) return
        setInitError("Couldn't connect to the server. Please check your connection and try again.")
        setIsTyping(false)
      })

    return () => { cancelled = true }
  }, [retryCount])

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !applicationId || isTyping || isComplete) return

    setInput('')
    const sellerMsg: InterviewMessage = {
      role: 'seller',
      content: text,
      ts: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, sellerMsg])
    setIsTyping(true)

    try {
      const response = await sendMessage(applicationId, text)

      const taylorMsg: InterviewMessage = {
        role: 'taylor',
        content: response.message,
        ts: new Date().toISOString(),
        verificationResult: response.verification ?? undefined,
      }
      setMessages((prev) => [...prev, taylorMsg])
      setIsTyping(false)

      if (response.complete) {
        setIsComplete(true)
        setCompletionTier(response.tier ?? null)
        setCompletionSummary(response.summary ?? null)
        AccessibilityInfo.announceForAccessibility('Interview complete! Your seller account is ready.')
      }
    } catch {
      setIsTyping(false)
      const errorMsg: InterviewMessage = {
        role: 'taylor',
        content: "Sorry, I dropped the connection for a second — could you say that again?",
        ts: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    }
  }, [input, applicationId, isTyping, isComplete])

  // Build list items
  const listItems: UIItem[] = [
    ...messages.map((m, i) => ({
      key: `msg-${i}-${m.ts}`,
      type: 'message' as const,
      message: m,
    })),
    ...(isTyping ? [{ key: 'typing', type: 'typing' as const }] : []),
  ]

  const renderItem = ({ item }: { item: UIItem }) => {
    if (item.type === 'typing') return <TypingIndicator />
    return <ChatBubble message={item.message} />
  }

  if (initError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.errorScreen}>
          <Text style={styles.errorText}>{initError}</Text>
          <Pressable style={styles.retryBtn} onPress={() => setRetryCount((n) => n + 1)}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.taylorDot} />
          <Text style={styles.headerTitle}>Taylor</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Completion card */}
        {isComplete && completionTier && (
          <View style={styles.completionCard}>
            <Text style={styles.completionTitle}>
              {tierEmoji(completionTier)} You're in — Tier {completionTier}
            </Text>
            {completionSummary && (
              <Text style={styles.completionBody}>{completionSummary}</Text>
            )}
            <Pressable
              style={styles.completionBtn}
              onPress={() => router.replace('/')}
              accessibilityRole="button"
            >
              <Text style={styles.completionBtnText}>Start listing products →</Text>
            </Pressable>
          </View>
        )}

        {/* Input bar — glass, same pattern as PromptBar */}
        {!isComplete && (
          <View style={styles.inputWrapper}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={68} tint={c.glassTint} style={styles.inputContainer}>
                <View style={styles.inputInner}>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder={isTyping ? '' : 'Type your reply...'}
                    placeholderTextColor={c.textMuted}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    editable={!isTyping}
                    multiline
                    accessibilityLabel="Type your reply to Taylor"
                  />
                  <Pressable
                    style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim() || isTyping}
                    accessibilityRole="button"
                    accessibilityLabel="Send reply"
                  >
                    {isTyping ? (
                      <ActivityIndicator size="small" color={c.textOnPrimary} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </BlurView>
            ) : (
              <View style={[styles.inputContainer, { backgroundColor: c.promptBg }]}>
                <View style={styles.inputInner}>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder={isTyping ? '' : 'Type your reply...'}
                    placeholderTextColor={c.textMuted}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    editable={!isTyping}
                    multiline
                  />
                  <Pressable
                    style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!input.trim() || isTyping}
                  >
                    {isTyping ? (
                      <ActivityIndicator size="small" color={c.textOnPrimary} />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function tierEmoji(tier: 1 | 2 | 3): string {
  return tier === 1 ? '🏆' : tier === 2 ? '✅' : '🌱'
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    taylorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.success,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },

    kav: { flex: 1 },
    listContent: {
      paddingTop: 12,
      paddingBottom: 12,
    },

    // Completion
    completionCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 20,
      padding: 20,
      gap: 10,
    },
    completionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
    },
    completionBody: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 21,
    },
    completionBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    completionBtnText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '700',
    },

    // Input bar
    inputWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 4,
    },
    inputContainer: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.glassBorder,
      overflow: 'hidden',
      ...floatShadow,
    },
    inputInner: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: c.glassBackground,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: c.text,
      maxHeight: 100,
      paddingVertical: 2,
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.35,
    },

    // Error state
    errorScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 20,
    },
    errorText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 12,
    },
    retryText: {
      color: c.textOnPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
  })
}
