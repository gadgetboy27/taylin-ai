import React, { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { createDeal } from '@/lib/deals-api'

const EXPIRY_OPTIONS = [
  { label: 'Today only', hours: 24 },
  { label: 'This week', hours: 24 * 7 },
]

export default function PostDealScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const styles = makeStyles(c)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [expiryHours, setExpiryHours] = useState(EXPIRY_OPTIONS[0].hours)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = title.trim().length > 0
    && Number(price) > 0
    && Number.isInteger(Number(quantity)) && Number(quantity) > 0

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const expiresAt = new Date(Date.now() + expiryHours * 3600_000).toISOString()
      await createDeal({
        title: title.trim(),
        description: description.trim() || undefined,
        price: Number(price),
        quantity: Number(quantity),
        expiresAt,
      })
      router.back()
    } catch {
      Alert.alert('Couldn\'t post deal', 'Please check your details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.heading}>Post a deal</Text>
        <Text style={styles.subheading}>
          A time- or quantity-limited offer, separate from your regular catalogue.
        </Text>

        <Text style={styles.label}>What's the deal?</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Sourdough loaves"
          placeholderTextColor={c.textMuted}
        />

        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="A quick description"
          placeholderTextColor={c.textMuted}
          multiline
        />

        <Text style={styles.label}>Price (NZD)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="24.00"
          placeholderTextColor={c.textMuted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>How many available?</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="10"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>How long should it run?</Text>
        <View style={styles.expiryRow}>
          {EXPIRY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              style={[styles.expiryChip, expiryHours === opt.hours && styles.expiryChipActive]}
              onPress={() => setExpiryHours(opt.hours)}
            >
              <Text style={[styles.expiryChipText, expiryHours === opt.hours && styles.expiryChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityLabel="Post deal"
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Posting…' : 'Post deal'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { padding: 24, gap: 4 },
    backText: { color: c.accent, fontSize: 16, marginBottom: 12 },
    heading: { fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 4 },
    subheading: { fontSize: 14, color: c.textSecondary, marginBottom: 24, lineHeight: 20 },

    label: { fontSize: 13, fontWeight: '600', color: c.textMuted, marginTop: 16, marginBottom: 6 },
    input: {
      backgroundColor: c.glassBackground,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text,
    },
    multiline: { minHeight: 70, textAlignVertical: 'top' },

    expiryRow: { flexDirection: 'row', gap: 10 },
    expiryChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    expiryChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    expiryChipText: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },
    expiryChipTextActive: { color: c.textOnPrimary },

    submitBtn: { backgroundColor: c.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '700' },
  })
}
