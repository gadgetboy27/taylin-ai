import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

// Requests permission (no-op if already granted/denied) and, if granted,
// registers the device's Expo push token with the backend so it can receive
// order alerts and proactive suggestions. Silently does nothing on web or on
// simulators, where push tokens aren't available.
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync()
    status = request.status
  }
  if (status !== 'granted') return

  const { data: token } = await Notifications.getExpoPushTokenAsync()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  await fetch(`${API_URL}/notifications/register-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    }),
  }).catch(() => {
    // Best-effort — a failed registration just means push delivery is
    // unavailable until the next successful call; in-app pull still works.
  })
}
