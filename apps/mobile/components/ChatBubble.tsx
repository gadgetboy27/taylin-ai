import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { cardShadow } from '@/lib/styles'
import type { InterviewMessage } from '@/lib/seller-api'

interface ChatBubbleProps {
  message: InterviewMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { theme } = useTheme()
  const c = theme.colors
  const isTaylor = message.role === 'taylor'
  const styles = makeStyles(c)

  return (
    <View style={[styles.row, isTaylor ? styles.rowLeft : styles.rowRight]}>
      {isTaylor && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>T</Text>
        </View>
      )}

      <View style={styles.bubbleWrapper}>
        <View style={[styles.bubble, isTaylor ? styles.bubbleTaylor : styles.bubbleSeller]}>
          <Text style={[styles.text, isTaylor ? styles.textTaylor : styles.textSeller]}>
            {message.content}
          </Text>
        </View>

        {/* Verification result chip — appears below Taylor's message if a check ran */}
        {message.verificationResult && (
          <View style={[
            styles.verifyChip,
            message.verificationResult.success ? styles.verifySuccess : styles.verifyFail,
          ]}>
            <View style={[
              styles.verifyDot,
              { backgroundColor: message.verificationResult.success ? c.success : c.error },
            ]} />
            <Text style={[
              styles.verifyText,
              { color: message.verificationResult.success ? c.success : c.error },
            ]}>
              {verifyIcon(message.verificationResult.type)} {message.verificationResult.label}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function TypingIndicator() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <View style={[styles.row, styles.rowLeft]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>T</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleTaylor, styles.typingBubble]}>
        <Text style={styles.typingDots}>• • •</Text>
      </View>
    </View>
  )
}

function verifyIcon(type: string): string {
  if (type === 'nzbn') return '🏢'
  if (type === 'url') return '🌐'
  return '🔍'
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginBottom: 12,
      alignItems: 'flex-end',
      paddingHorizontal: 16,
    },
    rowLeft: {
      justifyContent: 'flex-start',
    },
    rowRight: {
      justifyContent: 'flex-end',
    },

    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginBottom: 2,
    },
    avatarText: {
      color: c.textOnPrimary,
      fontSize: 14,
      fontWeight: '700',
    },

    bubbleWrapper: {
      maxWidth: '78%',
      gap: 6,
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 11,
      ...cardShadow,
    },
    bubbleTaylor: {
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderBottomLeftRadius: 4,
    },
    bubbleSeller: {
      backgroundColor: c.primary,
      borderBottomRightRadius: 4,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
    },
    textTaylor: {
      color: c.text,
    },
    textSeller: {
      color: c.textOnPrimary,
    },

    // Verification chips
    verifyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 6,
      marginLeft: 4,
    },
    verifySuccess: {
      backgroundColor: c.success + '15',
      borderWidth: 1,
      borderColor: c.success + '30',
    },
    verifyFail: {
      backgroundColor: c.error + '12',
      borderWidth: 1,
      borderColor: c.error + '25',
    },
    verifyDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    verifyText: {
      fontSize: 12,
      fontWeight: '500',
    },

    typingBubble: {
      paddingVertical: 14,
    },
    typingDots: {
      color: c.textMuted,
      fontSize: 16,
      letterSpacing: 4,
    },
  })
}
