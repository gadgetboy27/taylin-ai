/**
 * Global notifications layer — requests push permission and registers the
 * device's token once per app session. Screens that need to display
 * notifications use the separate `useNotifications` hook (pull side); this
 * context is just the push-registration lifecycle, mirroring how
 * VoiceContext wraps its own on-device concern.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { registerForPushNotifications } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

interface NotificationsContextValue {
  pushRegistered: boolean
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [pushRegistered, setPushRegistered] = useState(false)
  // Which user we've already registered this device for, so the hourly
  // TOKEN_REFRESHED events don't re-POST the same token.
  const registeredFor = useRef<string | null>(null)

  // Registration has to wait for a session. This provider mounts at the app
  // root, above the auth gate, so running it on mount meant
  // registerForPushNotifications() hit its `if (!session) return` and a
  // first-time user's token was never registered — nothing retried after
  // sign-in. Waiting for the session also stops the OS permission prompt
  // appearing on the sign-in screen, before the user knows what it's for.
  useEffect(() => {
    let cancelled = false

    const register = async (userId: string | undefined) => {
      if (!userId || registeredFor.current === userId) return
      registeredFor.current = userId
      try {
        await registerForPushNotifications()
        if (!cancelled) setPushRegistered(true)
      } catch {
        if (!cancelled) setPushRegistered(false)
      }
    }

    // Returning user — session already restored from AsyncStorage.
    supabase.auth.getSession().then(({ data }) => register(data.session?.user.id))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        register(session.user.id)
      } else {
        // Signed out — let the next user register their own token.
        registeredFor.current = null
        setPushRegistered(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return (
    <NotificationsContext.Provider value={{ pushRegistered }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used inside NotificationsProvider')
  return ctx
}
