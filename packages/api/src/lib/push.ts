import { supabase } from './supabase.js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// Sends a notification to a user: writes it to the notifications table (so
// it shows up in-app even if push delivery fails or the user has no
// registered device), then best-effort pushes to every registered Expo
// token. Push delivery failure never blocks the notification from existing.
export async function sendNotification(params: {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<{ notificationId: string | null; pushed: number }> {
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    })
    .select('id')
    .single()

  if (error) return { notificationId: null, pushed: 0 }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', params.userId)

  if (!tokens?.length) return { notificationId: notification.id, pushed: 0 }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  }))

  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
  } catch {
    // Push delivery is best-effort — the notification row already exists
    // for in-app pull, so a delivery failure here isn't fatal.
  }

  return { notificationId: notification.id, pushed: tokens.length }
}

const EXPO_PUSH_BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Broadcast variant of sendNotification — same insert-then-push shape, but
// for many recipients at once (e.g. lib/broadcast.ts's geo-expansion tiers).
// One notifications row per user (so each user's in-app feed/pull works
// exactly like the single-user path), Expo push requests batched at 100
// messages each per Expo's own recommended limit.
export async function sendNotificationBatch(
  userIds: string[],
  params: { title: string; body: string; data?: Record<string, unknown> }
): Promise<{ notified: number; pushed: number }> {
  if (userIds.length === 0) return { notified: 0, pushed: 0 }

  const { error } = await supabase
    .from('notifications')
    .insert(userIds.map((userId) => ({
      user_id: userId,
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    })))

  if (error) return { notified: 0, pushed: 0 }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)

  if (!tokens?.length) return { notified: userIds.length, pushed: 0 }

  const messages = tokens.map((t) => ({
    to: t.token,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  }))

  for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      })
    } catch {
      // Best-effort per batch — a failed chunk doesn't roll back the
      // notifications rows already written, and doesn't stop later chunks.
    }
  }

  return { notified: userIds.length, pushed: tokens.length }
}
