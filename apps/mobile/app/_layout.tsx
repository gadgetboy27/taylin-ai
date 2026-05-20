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
    // Check session once on mount, then navigate accordingly
    supabase.auth.getSession().then(({ data }) => {
      SplashScreen.hideAsync()
      navigationReady.current = true
      if (!data.session) {
        router.replace('/(auth)')
      }
    })

    // Redirect on every future auth state change
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
            <Stack.Screen name="seller" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
