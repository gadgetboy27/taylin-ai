import { Hono } from 'hono'
import { transcribeAudio } from '../lib/deepgram.js'

export const voiceRoute = new Hono()

// POST /voice/transcribe
// Accepts audio file upload, returns transcription text.
// Audio never leaves our server — Deepgram key stays server-side.
voiceRoute.post('/transcribe', async (c) => {
  const body = await c.req.parseBody()
  const file = body['audio']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No audio file provided' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'audio/m4a'

  const transcript = await transcribeAudio(buffer, mimeType).catch((err: Error) => {
    console.error('[voice] transcription failed:', err.message)
    return null
  })

  if (transcript === null) {
    return c.json({ error: 'Transcription failed' }, 500)
  }

  return c.json({ transcript })
})
