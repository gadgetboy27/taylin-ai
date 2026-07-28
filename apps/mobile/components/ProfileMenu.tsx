import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { ThemeSelector } from '@/components/ThemeSelector'
import { supabase } from '@/lib/supabase'
import { floatShadow } from '@/lib/styles'

/** Initials for the avatar — email local-part is the only name most users have. */
function initialsFrom(email: string | null, name: string | null): string {
  const source = name?.trim() || email?.split('@')[0] || ''
  const words = source.replace(/[._-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function ProfileMenu() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null)
        // Google fills these; phone signups have neither.
        const meta = data.user?.user_metadata as { full_name?: string; name?: string } | undefined
        setName(meta?.full_name ?? meta?.name ?? null)
      })
      .catch(() => {/* signed out — avatar just shows "?" */})
  }, [])

  const go = useCallback((path: string) => {
    setOpen(false)
    router.push(path as Parameters<typeof router.push>[0])
  }, [])

  const signOut = useCallback(() => {
    setOpen(false)
    const doSignOut = () => { supabase.auth.signOut().catch(() => {}) }

    // Alert isn't available on web, where it silently no-ops — confirm() is.
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of taylin.ai?')) doSignOut()
      return
    }
    Alert.alert('Sign out', 'You’ll need to sign in again to search or buy.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: doSignOut },
    ])
  }, [])

  return (
    <>
      <Pressable
        style={styles.avatar}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Your profile and settings"
        hitSlop={6}
      >
        <Text style={styles.avatarText}>{initialsFrom(email, name)}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Backdrop closes the menu — expected behaviour for a dropdown, and
            the only dismissal affordance on web where there's no back gesture. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, floatShadow]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.identity}>
              <Text style={styles.identityName} numberOfLines={1}>
                {name ?? email?.split('@')[0] ?? 'Signed in'}
              </Text>
              {email && <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text>}
            </View>

            <View style={styles.divider} />

            <MenuItem label="Delivery area & wallet" onPress={() => go('/(tabs)/wallet')} c={c} />
            <MenuItem label="Your agent & preferences" onPress={() => go('/(tabs)/agent')} c={c} />
            <MenuItem label="Sell on taylin.ai" onPress={() => go('/seller/apply')} c={c} />

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Appearance</Text>
            <View style={styles.themeRow}>
              <ThemeSelector />
            </View>

            <View style={styles.divider} />

            <Pressable
              onPress={signOut}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function MenuItem({ label, onPress, c }: {
  label: string
  onPress: () => void
  c: ReturnType<typeof useTheme>['theme']['colors']
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ paddingVertical: 12 }}>
      <Text style={{ fontSize: 15, color: c.text }}>{label}</Text>
    </Pressable>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // textOnPrimary rather than a fixed white: c.primary is near-white in the
    // Dark theme, so white initials would be invisible there.
    avatarText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '700' },

    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'flex-end',
      paddingTop: Platform.OS === 'web' ? 64 : 96,
      paddingHorizontal: 16,
    },
    sheet: {
      width: 260,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    identity: { paddingVertical: 6 },
    identityName: { fontSize: 15, fontWeight: '700', color: c.text },
    identityEmail: { fontSize: 12, color: c.textMuted, marginTop: 2 },

    divider: { height: 1, backgroundColor: c.border, marginVertical: 8 },
    item: { paddingVertical: 12 },
    sectionLabel: { fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    themeRow: { paddingTop: 10, paddingBottom: 4 },
    signOutText: { fontSize: 15, color: c.error, fontWeight: '600' },
  })
}
