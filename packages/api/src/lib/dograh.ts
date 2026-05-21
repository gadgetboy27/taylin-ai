/**
 * Dograh voice agent integration — future feature.
 * Dograh is an open-source Vapi alternative for building AI voice calling agents.
 * Docs: https://docs.dograh.com
 *
 * When ready:
 *  1. Self-host Dograh or use app.dograh.com
 *  2. Add DOGRAH_API_URL and DOGRAH_API_KEY to packages/api/.env
 *  3. Implement createVoiceAgent() below
 *
 * taylin.ai use case: "Call taylin" button → Dograh connects user to an AI buyer's
 * agent that can search, recommend, and place orders entirely over voice.
 */

const dograhUrl = process.env.DOGRAH_API_URL
const dograhKey = process.env.DOGRAH_API_KEY

export const isDograhConfigured = !!(dograhUrl && dograhKey)

if (!isDograhConfigured) {
  console.info('[dograh] Not configured — voice agent feature disabled (set DOGRAH_API_URL + DOGRAH_API_KEY when ready)')
}

export type DograhAgentConfig = {
  name: string
  welcomeMessage: string
  systemPrompt: string
  voice?: string
  language?: string
}

export const TAYLIN_AGENT_CONFIG: DograhAgentConfig = {
  name: 'taylin',
  welcomeMessage: "Kia ora! I'm taylin, your AI buyer's agent. What are you looking for today?",
  systemPrompt: `You are taylin, an AI buyer's agent for New Zealand shoppers.
You help users find the best products at the best prices, verify sellers, and place orders securely.
Keep responses concise — this is a voice conversation.
When you have enough information to search, say "Let me search for that now."
Always confirm price and seller before completing a purchase.`,
  voice: 'aura-asteria-en',
  language: 'en-NZ',
}

// Placeholder — implement when Dograh credentials are added
export async function createVoiceSession(_userId: string): Promise<{ sessionUrl: string }> {
  if (!isDograhConfigured) {
    throw new Error('Dograh not configured — add DOGRAH_API_URL and DOGRAH_API_KEY to packages/api/.env')
  }

  // TODO: POST to Dograh API to create a session with TAYLIN_AGENT_CONFIG
  // const res = await fetch(`${dograhUrl}/sessions`, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${dograhKey}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ agent: TAYLIN_AGENT_CONFIG, metadata: { userId } }),
  // })
  // const { session_url } = await res.json()
  // return { sessionUrl: session_url }

  throw new Error('Dograh integration not yet implemented')
}
