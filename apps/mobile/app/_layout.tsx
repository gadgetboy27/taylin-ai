import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Stack, router } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeProvider } from '@/context/ThemeContext'
import { VoiceProvider } from '@/context/VoiceContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { PatternProvider } from '@/context/PatternContext'
import { PatternConfirmPrompt } from '@/components/PatternConfirmPrompt'
import { supabase } from '@/lib/supabase'

SplashScreen.preventAutoHideAsync()

// Silence errors thrown by browser extensions (MetaMask, etc.) so they don't
// surface in our React error boundary or pollute the console as "Uncaught".
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const isBrowserExtension = (src?: string) =>
    typeof src === 'string' && src.startsWith('chrome-extension://')

  window.addEventListener('error', (e) => {
    if (isBrowserExtension(e.filename)) { e.stopImmediatePropagation(); e.preventDefault() }
  }, true)

  window.addEventListener('unhandledrejection', (e) => {
    const src = (e.reason as Error | undefined)?.stack ?? ''
    if (src.includes('chrome-extension://')) { e.stopImmediatePropagation(); e.preventDefault() }
  }, true)
}

export default function RootLayout() {
  const navigationReady = useRef(false)

  useEffect(() => {
    // TEMPORARY — sign-in is bypassed while Google and SMS are being fixed.
    // The app opens straight into (tabs) on an anonymous Supabase session
    // rather than skipping auth outright: every API route still requires a
    // real JWT, so a client-only bypass would just 401 on the first search.
    // An anonymous user is a genuine auth.users row, so the 018 trigger
    // provisions public.users and searches/orders keep working.
    // Flip AUTH_REQUIRED back to true to restore the sign-in gate.
    const AUTH_REQUIRED = false

    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return true
      if (AUTH_REQUIRED) return false
      const { error } = await supabase.auth.signInAnonymously()
      return !error
    }

    ensureSession()
      .then((ok) => {
        navigationReady.current = true
        SplashScreen.hideAsync()
        if (!ok) router.replace('/(auth)')
      })
      .catch(() => {
        // Stale or corrupt session — clear it and fall back to the auth screen
        supabase.auth.signOut().catch(() => {})
        navigationReady.current = true
        SplashScreen.hideAsync()
        router.replace('/(auth)')
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!navigationReady.current) return
      if (session) {
        router.replace('/(tabs)')
      } else if (AUTH_REQUIRED) {
        router.replace('/(auth)')
      }
      // Signed out with auth bypassed: stay put. The next mount picks up a
      // fresh anonymous session rather than bouncing to a gate we've disabled.
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <VoiceProvider>
            <NotificationsProvider>
              <PatternProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="result/[searchId]" options={{ presentation: 'card' }} />
                  <Stack.Screen name="result/approve" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="seller/index" />
                  <Stack.Screen name="seller/apply" />
                  <Stack.Screen name="seller/dashboard" />
                  <Stack.Screen name="seller/post-deal" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="deals/index" />
                </Stack>
                <PatternConfirmPrompt />
              </PatternProvider>
            </NotificationsProvider>
          </VoiceProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
