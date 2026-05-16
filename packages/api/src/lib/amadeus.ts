// Amadeus flight/hotel search — server only
// Docs: https://developers.amadeus.com

type AmadeusToken = { access_token: string; expires_at: number }
let cachedToken: AmadeusToken | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 30_000) {
    return cachedToken.access_token
  }

  const res = await fetch(
    process.env.AMADEUS_ENV === 'production'
      ? 'https://api.amadeus.com/v1/security/oauth2/token'
      : 'https://test.api.amadeus.com/v1/security/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_CLIENT_ID!,
        client_secret: process.env.AMADEUS_CLIENT_SECRET!,
      }),
    }
  )

  if (!res.ok) throw new Error('Amadeus auth failed')
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.access_token
}

export async function searchFlights(params: {
  origin: string
  destination: string
  date: string
  adults?: number
  maxPrice?: number
}): Promise<unknown[]> {
  const token = await getToken()
  const base = process.env.AMADEUS_ENV === 'production'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com'

  const qs = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.date,
    adults: String(params.adults ?? 1),
    currencyCode: 'NZD',
    max: '10',
    ...(params.maxPrice ? { maxPrice: String(params.maxPrice) } : {}),
  })

  const res = await fetch(`${base}/v2/shopping/flight-offers?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return []
  const data = await res.json() as { data?: unknown[] }
  return data.data ?? []
}
