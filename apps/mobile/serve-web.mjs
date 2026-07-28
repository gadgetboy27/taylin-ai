import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

// Serves the `expo export --platform web` output.
//
// Written by hand rather than pulling in a static-server dependency because of
// the SPA fallback: expo-router does client-side routing, so a deep link like
// /seller/apply has no file behind it and must be answered with index.html.
// Most trivial static servers 404 that, which breaks every shared link.

const ROOT = new URL('./dist/', import.meta.url).pathname
const PORT = parseInt(process.env.PORT ?? '8080', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

async function send(res, path, status = 200) {
  const body = await readFile(path)
  const type = MIME[extname(path)] ?? 'application/octet-stream'
  // Hashed bundle filenames can be cached hard; index.html must not be, or
  // clients keep booting an old build after a deploy.
  const cache = path.endsWith('index.html')
    ? 'no-cache'
    : 'public, max-age=31536000, immutable'
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cache })
  res.end(body)
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    // normalize + strip leading separators: stops ../ escaping the dist root.
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
    const candidate = join(ROOT, rel)

    if (rel) {
      try {
        const s = await stat(candidate)
        if (s.isFile()) return await send(res, candidate)
      } catch {/* fall through to the SPA fallback */}
    }

    await send(res, join(ROOT, 'index.html'))
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal error')
  }
}).listen(PORT, () => {
  console.log(`taylin.ai web serving ${ROOT} on port ${PORT}`)
})
