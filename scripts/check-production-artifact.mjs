import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const permanentCardUrlSha256 = 'b7e7d99e2dbc2b00012672c352c9cce56537acbd6e12b5d7b2ad187d92342a9f'
const cardHtmlPath = resolve(import.meta.dirname, '..', 'dist', 'me', 'index.html')

let html
try {
  html = readFileSync(cardHtmlPath, 'utf8')
} catch {
  throw new Error('A completed production build is required before deployment.')
}

const match = html.match(/<a\b[^>]*href="([^"]+)"[^>]*data-card-url/)
if (!match || createHash('sha256').update(match[1]).digest('hex') !== permanentCardUrlSha256) {
  throw new Error('Refusing to deploy an artifact without the permanent production card URL.')
}

console.log('Production artifact: permanent card URL verified')
