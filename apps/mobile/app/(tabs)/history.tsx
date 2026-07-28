import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ScreenHeader'
import { router } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'

type Order = {
  id: string
  status: string
  amount: number
  currency: string
  created_at: string
  products: { name: string } | null
}

export default function HistoryScreen() {
  const { theme } = useTheme()
  const c = theme.colors
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, status, amount, currency, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setOrders((data as unknown as Order[]) || []))
  }, [])

  const styles = makeStyles(c)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Purchase history" />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No purchases yet. Start searching!</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/result/approve?orderId=${item.id}`)}
            accessibilityLabel={`Order ${item.products?.name ?? 'unknown'}. Status: ${item.status}. Amount: $${item.amount} ${item.currency}.`}
            accessibilityRole="button"
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.products?.name ?? 'Product'}
              </Text>
              <Text style={styles.rowDate}>
                {new Date(item.created_at).toLocaleDateString('en-NZ')}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowAmount}>
                ${item.amount.toFixed(2)}
              </Text>
              <View style={[styles.statusDot, { backgroundColor: statusColor(item.status, c) }]} />
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  )
}

function statusColor(status: string, c: ReturnType<typeof useTheme>['theme']['colors']) {
  const map: Record<string, string> = {
    pending: c.warning,
    escrowed: c.accent,
    shipped: c.accent,
    delivered: c.success,
    released: c.success,
    disputed: c.error,
    refunded: c.error,
  }
  return map[status] ?? c.textMuted
}

function makeStyles(c: ReturnType<typeof useTheme>['theme']['colors']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    list: { paddingHorizontal: 20, paddingBottom: 32, gap: 8 },
    empty: { color: c.textMuted, fontSize: 15, textAlign: 'center', marginTop: 40 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 64,
    },
    rowLeft: { flex: 1, marginRight: 12 },
    rowName: { fontSize: 15, fontWeight: '600', color: c.text },
    rowDate: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    rowRight: { alignItems: 'flex-end', gap: 6 },
    rowAmount: { fontSize: 15, fontWeight: '700', color: c.text },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
  })
}
