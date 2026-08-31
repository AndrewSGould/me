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
  assert.equal((template.match(/<article class="role-card role-card--(?:yipitdata|cyberpunk)">/g) ?? []).length, 2)
  assert.equal((template.match(/class="role-mark role-mark--(?:yipitdata|cyberpunk)"/g) ?? []).length, 2)
  assert.match(styles, /\.roles\s*{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(styles, /\.role-mark\s*{[^}]*width: 54px;[^}]*aspect-ratio: 1/s)
})

test('adds explicit website controls without turning the role cards into links', () => {
  const roles = template.match(/<section class="roles"[\s\S]*?<\/section>/)?.[0] ?? ''

  assert.equal((roles.match(/class="role-card__link interactive-surface"/g) ?? []).length, 2)
  assert.match(roles, /href="https:\/\/yipitdata\.com\/"/)
  assert.match(roles, /aria-label="Visit the YipitData website"/)
  assert.match(roles, /href="https:\/\/matsuricon\.org\/"/)
  assert.match(roles, /aria-label="Visit the Matsuricon website"/)
  assert.equal((roles.match(/target="_blank"/g) ?? []).length, 2)
  assert.equal((roles.match(/rel="noreferrer noopener"/g) ?? []).length, 2)
  assert.doesNotMatch(roles, /role-card__arrow/)
  assert.equal((template.match(/\binteractive-surface\b/g) ?? []).length, 8)
  assert.equal((template.match(/class="button__icon"/g) ?? []).length, 2)
  assert.equal((template.match(/class="action__arrow"/g) ?? []).length, 4)
  assert.match(styles, /\.role-card__link\s*{[^}]*min-height: 42px;/s)
  assert.match(styles, /\.interactive-surface\s*{\s*cursor: pointer;/)
  assert.match(styles, /\.interactive-surface:focus-visible\s*{[^}]*border-color: rgba\(82, 232, 255, 0\.52\)/s)
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)\s*{[\s\S]*?\.interactive-surface:hover\s*{/)
  assert.doesNotMatch(styles, /\.role-card(?:--[\w-]+)?:hover/)
  assert.match(styles, /\.card-footer a\s*{[^}]*text-decoration-line: underline;/s)
})

test('rotates through three locally cropped identity images', () => {
  const avatarSources = [...template.matchAll(/class="avatar-rotator__image[^"]*"\s+src="([^"]+)"/g)].map(
    (match) => match[1],
  )

  assert.deepEqual(avatarSources, [
    '/me/avatar-creature.jpg',
    '/me/avatar-travel.jpg',
    '/me/avatar-selfie.jpg',
  ])
  for (const source of avatarSources) {
    assert.equal(existsSync(resolve(root, 'public', source.replace(/^\//, ''))), true)
  }
  assert.match(styles, /@keyframes avatar-cycle/)
  assert.match(styles, /\.avatar-rotator__image--travel\s*{\s*animation-delay: 3\.4s;/)
  assert.match(styles, /\.avatar-rotator__image:first-child\s*{\s*opacity: 1;/)
})

test('renders the nickname treatment and atomic tagline', () => {
  assert.match(
    template,
    /<h1 id="card-title">\{\{GIVEN_NAME\}\} <span class="identity__nickname">'Roo'<\/span> \{\{FAMILY_NAME\}\}<\/h1>/,
  )
  assert.match(template, /<p class="identity__lede">I\. Am\. Atomic\.<\/p>/)
  assert.match(generator, /GIVEN_NAME: profile\.givenName/)
  assert.match(generator, /FAMILY_NAME: profile\.familyName/)
  assert.match(styles, /--roo-purple: #cb6bd3/)
  assert.match(styles, /\.identity__nickname\s*{[^}]*-webkit-text-stroke: 1px var\(--roo-purple\)/s)
})

test('renders the second role title as two deterministic lines', () => {
  assert.match(
    template,
    /<h2 class="role-card__title role-card__title--stacked">\s*<span>\{\{ROLE_2_TITLE_LINE_1\}\}<\/span>\s*<span>\{\{ROLE_2_TITLE_LINE_2\}\}<\/span>\s*<\/h2>/,
  )
  assert.match(styles, /\.role-card__title--stacked span\s*{\s*display: block;/)
  assert.match(generator, /splitBalancedTitle\(profile\.roles\[1\]\.title\)/)
})

test('uses the official data-company wordmark and current brand palette', () => {
  assert.match(template, /class="role-card role-card--yipitdata"/)
  assert.match(template, /src="\/me\/yipitdata-logo\.svg" width="143" height="34" alt=""/)
  assert.equal(existsSync(resolve(root, 'public', 'me', 'yipitdata-logo.svg')), true)
  assert.match(styles, /--yipit-ink: #02272f/)
  assert.match(styles, /--yipit-cloud: #d5e8ec/)
  assert.match(styles, /--yipit-orange: #d9662f/)
  assert.match(styles, /\.role-card--yipitdata::before\s*{[^}]*radial-gradient/s)
})

test('uses the local cyberpunk mark and brand treatment', () => {
  assert.match(template, /class="role-card role-card--cyberpunk"/)
  assert.match(template, /src="\/me\/brand-kanji\.png" width="54" height="54" alt=""/)
  assert.equal(existsSync(resolve(root, 'public', 'me', 'brand-kanji.png')), true)
  assert.match(styles, /--cyber-cyan: #00f5ff/)
  assert.match(styles, /--cyber-pink: #ff2d78/)
  assert.match(styles, /\.role-card--cyberpunk\s*{[^}]*clip-path: polygon/s)
  assert.match(styles, /\.role-card--cyberpunk::before\s*{[^}]*repeating-linear-gradient/s)
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
