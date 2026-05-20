import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeProvider } from '@/context/ThemeContext'
import { supabase } from '@/lib/supabase'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const navigationReady = useRef(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        navigationReady.current = true
        SplashScreen.hideAsync()
        if (!data.session) {
          router.replace('/(auth)')
        }
      })
      .catch(() => {
        // Stale or corrupt session — clear it and go to auth
        supabase.auth.signOut().catch(() => {})
        navigationReady.current = true
        SplashScreen.hideAsync()
        router.replace('/(auth)')
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!navigationReady.current) return
      if (session) {
        router.replace('/(tabs)')
      } else {
        router.replace('/(auth)')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="result/[searchId]" options={{ presentation: 'card' }} />
            <Stack.Screen name="result/approve" options={{ presentation: 'modal' }} />
            <Stack.Screen name="seller/index" />
            <Stack.Screen name="seller/apply" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
