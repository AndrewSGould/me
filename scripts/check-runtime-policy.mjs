import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const documents = new Map([
  ['/', readFileSync(resolve(dist, 'index.html'), 'utf8')],
  ['/me/', readFileSync(resolve(dist, 'me', 'index.html'), 'utf8')],
  ['/404.html', readFileSync(resolve(dist, '404.html'), 'utf8')],
])
const cardHtml = documents.get('/me/')

function normalizeMeta(value) {
  return value.replaceAll('&#39;', "'").replaceAll('&quot;', '"')
}

for (const [route, html] of documents) {
  const normalized = normalizeMeta(html)
  const cspPosition = html.indexOf('http-equiv="Content-Security-Policy"')
  const firstResourcePosition = Math.min(
    ...['<script', '<link', '<img', '<use'].map((tag) => {
      const position = html.indexOf(tag)
      return position === -1 ? Number.POSITIVE_INFINITY : position
    }),
  )
  if (cspPosition === -1 || cspPosition > firstResourcePosition) {
    throw new Error('The meta CSP must precede every loadable resource in ' + route + '.')
  }
  for (const directive of [
    "default-src 'none'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]) {
    if (!normalized.includes(directive)) throw new Error('The meta CSP for ' + route + ' is incomplete.')
  }
  if (!html.includes('name="referrer" content="no-referrer"')) {
    throw new Error('The no-referrer meta policy is missing from ' + route + '.')
  }
}

if (!cardHtml.includes('name="robots" content="noindex,nofollow,noarchive,nosnippet"')) {
  throw new Error('The card is missing its crawler-blocking metadata.')
}
if (/<meta\s+(?:property|name)="(?:og:|twitter:)|rel="(?:canonical|sitemap)"/i.test(cardHtml)) {
  throw new Error('The card contains disallowed discovery or social metadata.')
}
if (!cardHtml.includes('href="/me/card-qr.svg"') || !cardHtml.includes('src="/me/card-qr.svg"')) {
  throw new Error('The card must expose its QR as both a direct fallback and dialog image.')
}

const webQr = readFileSync(resolve(dist, 'me', 'card-qr.svg'), 'utf8')
if (
  !webQr.includes('width="30mm" height="30mm" viewBox="0 0 37 37"') ||
  !webQr.includes('<rect width="37" height="37" fill="#fff"/>') ||
  !webQr.includes('<path fill="#000"')
) {
  throw new Error('The built QR must retain Version 3 geometry and opaque black-on-white rendering.')
}

const resourcePattern = /<(?:script|link|img|source|use)\b[^>]*(?:src|href)="([^"]+)"/gi
for (const [route, html] of documents) {
  for (const match of html.matchAll(resourcePattern)) {
    const resource = match[1]
    if (resource.startsWith('data:')) continue
    const resolvedResource = new URL(resource, new URL(route, 'https://site.invalid'))
    if (resolvedResource.origin !== 'https://site.invalid') {
      throw new Error('A loadable resource in ' + route + ' is not same-origin.')
    }
  }
}

if (existsSync(resolve(dist, 'card-qr.svg'))) {
  throw new Error('A stale QR remains at the origin root.')
}
if (readdirSync(dist).some((name) => name.toLowerCase().endsWith('.vcf'))) {
  throw new Error('A stale contact file remains at the origin root.')
}

const headers = readFileSync(resolve(dist, '_headers'), 'utf8')
for (const policy of [
  'Content-Security-Policy:',
  "frame-ancestors 'none'",
  'Referrer-Policy: no-referrer',
  'X-Content-Type-Options: nosniff',
  'X-Robots-Tag: noindex, nofollow, noarchive, nosnippet',
  'Permissions-Policy:',
  'Cache-Control: public, max-age=31536000, immutable',
]) {
  if (!headers.includes(policy)) throw new Error('The Cloudflare header rules are incomplete.')
}

const robots = readFileSync(resolve(dist, 'robots.txt'), 'utf8')
if (!/^User-agent: \*\r?\nDisallow: \/me\/\s*$/u.test(robots)) {
  throw new Error('robots.txt must discourage crawling only for /me/.')
}

const assetFiles = []
function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) collect(path)
    else if (['.css', '.js'].includes(extname(path))) assetFiles.push(path)
  }
}
collect(dist)

const assets = assetFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
if (/@import\s|url\(\s*["']?(?:https?:)?\/\//i.test(assets)) {
  throw new Error('A built asset attempts to load a third-party runtime resource.')
}
if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|serviceWorker\s*\./.test(assets)) {
  throw new Error('A built asset contains a runtime network or service-worker API.')
}

console.log(
  'Runtime policy: root and /me/ are static, same-origin only (' +
    relative(dist, resolve(dist, 'me', 'index.html')) +
    ')',
)
