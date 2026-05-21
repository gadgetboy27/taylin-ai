const apiKey = process.env.DEEPGRAM_API_KEY

if (!apiKey) {
  console.warn('[deepgram] DEEPGRAM_API_KEY not set — voice transcription disabled')
}

export const isDeepgramConfigured = !!apiKey

// Deepgram pre-recorded transcription via REST — no SDK needed, just fetch.
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  if (!apiKey) throw new Error('Deepgram not configured — add DEEPGRAM_API_KEY to packages/api/.env')

  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-NZ',
    smart_format: 'true',
    punctuate: 'true',
  })

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    body: audioBuffer,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Deepgram API error ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>
      }>
    }
  }

  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}
