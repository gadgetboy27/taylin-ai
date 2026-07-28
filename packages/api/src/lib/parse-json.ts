/**
 * Extract and parse JSON from an LLM text response.
 * Falls back to `fallback` if nothing valid is found.
 *
 * Handles both objects and arrays. The previous version matched only
 * /\{[\s\S]*\}/, so an array response like [{...},{...}] captured
 * `{...},{...}` — never valid JSON — and silently returned the fallback.
 * extractProducts is the one caller that returns an array, which is why
 * catalogue import found zero products on every site regardless of content.
 *
 * Also strips markdown fences: models wrap JSON in ```json blocks fairly often
 * even when the system prompt forbids it, and that is not worth losing a
 * response over.
 */
export function parseJsonFromText<T>(text: string, fallback: T): T {
  const unfenced = text
    .replace(/^[\s\r\n]*```(?:json|JSON)?[\s\r\n]*/, '')
    .replace(/[\s\r\n]*```[\s\r\n]*$/, '')
    .trim()

  // Clean responses parse as-is — the common case, and avoids the regex
  // mangling anything.
  try {
    return JSON.parse(unfenced) as T
  } catch {
    // fall through to extraction
  }

  // Otherwise take the outermost bracketed span, whichever kind comes first,
  // so prose either side of the JSON doesn't defeat it.
  const firstObj = unfenced.indexOf('{')
  const firstArr = unfenced.indexOf('[')
  const starts = [firstObj, firstArr].filter((i) => i !== -1)
  if (starts.length === 0) return fallback

  const start = Math.min(...starts)
  const closer = unfenced[start] === '[' ? ']' : '}'
  const end = unfenced.lastIndexOf(closer)
  if (end <= start) return fallback

  try {
    return JSON.parse(unfenced.slice(start, end + 1)) as T
  } catch {
    return fallback
  }
}
