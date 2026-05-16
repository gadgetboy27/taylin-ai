import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'

export const preferencesRoute = new Hono()

preferencesRoute.get('/', async (c) => {
  const userId = c.get('userId')
  const { data } = await supabase
    .from('preferences')
    .select('id, category, positive_signals, negative_signals, last_updated')
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })

  return c.json({ preferences: data ?? [] })
})

preferencesRoute.delete('/:category', async (c) => {
  const userId = c.get('userId')
  const category = c.req.param('category')

  await supabase
    .from('preferences')
    .delete()
    .eq('user_id', userId)
    .eq('category', category)

  return c.json({ ok: true })
})
