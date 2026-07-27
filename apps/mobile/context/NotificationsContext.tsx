/**
 * Global notifications layer — requests push permission and registers the
 * device's token once per app session. Screens that need to display
 * notifications use the separate `useNotifications` hook (pull side); this
 * context is just the push-registration lifecycle, mirroring how
 * VoiceContext wraps its own on-device concern.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { registerForPushNotifications } from '@/lib/notifications'

interface NotificationsContextValue {
  pushRegistered: boolean
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [pushRegistered, setPushRegistered] = useState(false)

  useEffect(() => {
    registerForPushNotifications()
      .then(() => setPushRegistered(true))
      .catch(() => setPushRegistered(false))
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
