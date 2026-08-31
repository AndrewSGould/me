import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const template = readFileSync(resolve(root, 'index.template.html'), 'utf8')
const styles = readFileSync(resolve(root, 'src', 'style.css'), 'utf8')
const script = readFileSync(resolve(root, 'src', 'main.ts'), 'utf8')
const generator = readFileSync(resolve(root, 'scripts', 'generate-profile.mjs'), 'utf8')
const home = readFileSync(resolve(root, 'index.html'), 'utf8')
const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')

test('keeps essential contact routes and details available without JavaScript', () => {
  assert.match(template, /<span data-discord-handle>\{\{DISCORD_USERNAME\}\}<\/span>/)
  assert.match(template, /href="\{\{DISCORD_DEEP_LINK\}\}"/)
  assert.match(template, /href="\{\{VCARD_PATH\}\}" download/)
  assert.match(template, /href="\{\{MAILTO_URL\}\}"/)
  assert.match(template, /href="\{\{LINKEDIN_URL\}\}"/)
  assert.match(template, /href="\{\{CARD_URL\}\}" data-card-url/)
  assert.match(template, /href="\{\{QR_PATH\}\}"[\s\S]*?data-show-qr/)
  assert.equal((template.match(/no-js-hidden/g) ?? []).length, 1)
  assert.match(styles, /\.no-js \.no-js-hidden\s*{\s*display: none;/)
})

test('keeps both professional roles structurally equal and logo-slot compatible', () => {
  assert.equal((template.match(/<article class="role-card">/g) ?? []).length, 2)
  assert.equal((template.match(/class="role-mark(?: role-mark--alt)?"/g) ?? []).length, 2)
  assert.match(styles, /\.roles\s*{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(styles, /\.role-mark\s*{[^}]*width: 54px;[^}]*aspect-ratio: 1/s)
})

test('includes privacy metadata, external-link protection, and complete fallbacks', () => {
  assert.match(template, /name="robots" content="noindex,nofollow,noarchive,nosnippet"/)
  assert.match(template, /name="referrer" content="no-referrer"/)
  assert.match(template, /rel="noreferrer noopener"/)
  assert.match(template, /<dialog[^>]+aria-labelledby="qr-dialog-title"[^>]+aria-describedby="qr-dialog-description"[^>]+data-qr-dialog>/)
  assert.match(template, /<img[\s\S]*?src="\{\{QR_PATH\}\}"[\s\S]*?alt="QR code that opens/)
  assert.match(template, /<a class="qr-dialog__url" href="\{\{CARD_URL\}\}">\{\{CARD_URL_DISPLAY\}\}<\/a>/)
  assert.doesNotMatch(template, /property="og:|name="twitter:|rel="canonical"/)
})

test('progressively enhances the direct QR link into a native dialog', () => {
  assert.match(template, /href="\{\{QR_PATH\}\}"[\s\S]*?target="_blank"[\s\S]*?data-show-qr/)
  assert.match(script, /typeof qrDialog\.showModal !== 'function'/)
  assert.match(script, /event\.preventDefault\(\)/)
  assert.match(script, /qrDialog\.showModal\(\)/)
  assert.match(script, /qrDialog\?\.addEventListener\('close'/)
  assert.doesNotMatch(script, /navigator\.share|data-share-card|shareValue/)
})

test('limits pointer effects and removes decorative movement for reduced motion', () => {
  assert.match(script, /\(hover: hover\) and \(pointer: fine\)/)
  assert.match(script, /prefers-reduced-motion: reduce/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /\.card-stage,\s*\.button,\s*\.action\s*{\s*transform: none !important;/s)
})

test('keeps the homepage and permanent card route as separate Vite entries', () => {
  assert.match(home, /href="\/me\/"/)
  assert.doesNotMatch(home, /\{\{[A-Z0-9_]+\}\}/)
  assert.match(viteConfig, /base: '\/'/)
  assert.match(viteConfig, /home: resolve\(import\.meta\.dirname, 'index\.html'\)/)
  assert.match(viteConfig, /card: resolve\(import\.meta\.dirname, 'me', 'index\.html'\)/)
  assert.match(generator, /writeFileSync\(resolve\(root, 'me', 'index\.html'\), html\)/)
  assert.match(generator, /resolve\(root, 'public', 'me', webQrFileName\)/)
  assert.match(template, /href="\/me\/icons\.svg#discord-icon"/)
})

test('includes Cloudflare static-asset routing, headers, and crawler controls', () => {
  const wrangler = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'))
  const headers = readFileSync(resolve(root, 'public', '_headers'), 'utf8')
  const robots = readFileSync(resolve(root, 'public', 'robots.txt'), 'utf8')

  assert.equal(wrangler.assets.directory, './dist')
  assert.equal(wrangler.assets.html_handling, 'auto-trailing-slash')
  assert.equal(wrangler.assets.not_found_handling, '404-page')
  assert.deepEqual(wrangler.routes, [{ pattern: 'heyroo.dev', custom_domain: true }])
  assert.match(headers, /\/me\/\*[\s\S]*X-Robots-Tag: noindex, nofollow, noarchive, nosnippet/)
  assert.match(headers, /frame-ancestors 'none'/)
  assert.equal(robots.replaceAll('\r\n', '\n'), 'User-agent: *\nDisallow: /me/\n')
  assert.equal(existsSync(resolve(root, '.github', 'workflows', 'deploy-pages.yml')), false)
})
