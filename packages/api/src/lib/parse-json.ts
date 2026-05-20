/**
 * Extract and parse the first JSON object from an LLM text response.
 * Falls back to `fallback` if no valid JSON is found.
 */
export function parseJsonFromText<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return fallback
  }
}
