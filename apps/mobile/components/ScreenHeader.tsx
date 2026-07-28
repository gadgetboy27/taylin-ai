import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { ProfileMenu } from '@/components/ProfileMenu'

type Props = {
  title?: string
  subtitle?: string
  /** Show a back chevron on the left. */
  back?: boolean
  /** Extra controls, rendered to the left of the avatar. */
  right?: React.ReactNode
  /** Hide the avatar — only for screens reached before sign-in. */
  profile?: boolean
}

/**
 * The single top bar for every screen.
 *
 * Each screen used to build its own — seven screens had six different patterns
 * (topRow / headerRow / header / eyebrow / bare title), the avatar existed on
 * exactly one of them, and controls drifted between left and right depending on
 * which screen you were looking at. Nothing could stay aligned because nothing
 * shared a definition.
 *
 * Geometry is fixed: back or nothing on the left, title next to it, extras then
 * the avatar on the right. Screens choose content, never position.
 */
export function ScreenHeader({ title, subtitle, back, right, profile = true }: Props) {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {back && (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </Pressable>
        )}
        {!!title && (
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.rightGroup}>
        {right}
        {profile && <ProfileMenu />}
      </View>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 12,
      minHeight: 56,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    backBtn: { marginLeft: -6 },
    titleBlock: { flexShrink: 1 },
    title: { fontSize: 22, fontWeight: '700', color: c.text },
    subtitle: { fontSize: 13, color: c.textMuted, marginTop: 1 },
    rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  })
}
