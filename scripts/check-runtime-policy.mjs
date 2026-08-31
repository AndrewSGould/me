import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')

const requiredHtmlPolicies = [
  'http-equiv="Content-Security-Policy"',
  'default-src &#39;none&#39;',
  'script-src &#39;self&#39;',
  'style-src &#39;self&#39;',
  'img-src &#39;self&#39;',
  'connect-src &#39;none&#39;',
  'object-src &#39;none&#39;',
  'base-uri &#39;none&#39;',
  'form-action &#39;none&#39;',
  'name="referrer" content="no-referrer"',
  'name="robots" content="noindex,nofollow,noarchive,nosnippet"',
]
if (requiredHtmlPolicies.some((policy) => !html.includes(policy))) {
  throw new Error('Built HTML is missing a required privacy or CSP policy.')
}

const cspPosition = html.indexOf('http-equiv="Content-Security-Policy"')
const firstResourcePosition = Math.min(
  ...['<script', '<link', '<img', '<use'].map((tag) => {
    const position = html.indexOf(tag)
    return position === -1 ? Number.POSITIVE_INFINITY : position
  }),
)
if (cspPosition === -1 || cspPosition > firstResourcePosition) {
  throw new Error('The meta CSP must precede every loadable resource.')
}

if (/<meta\s+(?:property|name)="(?:og:|twitter:)|rel="(?:canonical|sitemap)"/i.test(html)) {
  throw new Error('Built HTML contains disallowed discovery or social metadata.')
}

for (const match of html.matchAll(/<(?:script|link|img|source|use)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
  const resource = match[1]
  if (/^(?:https?:)?\/\//i.test(resource) || (!resource.startsWith('/me/') && !resource.startsWith('data:'))) {
    throw new Error('A loadable runtime resource is not same-origin under /me/.')
  }
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

console.log('Runtime policy: same-origin static resources only; privacy metadata and CSP present')
