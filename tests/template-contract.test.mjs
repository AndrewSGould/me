import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const template = readFileSync(resolve(root, 'index.template.html'), 'utf8')
const styles = readFileSync(resolve(root, 'src', 'style.css'), 'utf8')
const script = readFileSync(resolve(root, 'src', 'main.ts'), 'utf8')

test('keeps essential contact routes and details available without JavaScript', () => {
  assert.match(template, /<span data-discord-handle>\{\{DISCORD_USERNAME\}\}<\/span>/)
  assert.match(template, /href="\{\{DISCORD_DEEP_LINK\}\}"/)
  assert.match(template, /href="\{\{VCARD_PATH\}\}" download/)
  assert.match(template, /href="\{\{MAILTO_URL\}\}"/)
  assert.match(template, /href="\{\{LINKEDIN_URL\}\}"/)
  assert.match(template, /href="\{\{CARD_URL\}\}" data-card-url/)
  assert.equal((template.match(/no-js-hidden/g) ?? []).length, 2)
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
  assert.match(template, /data-manual-url>\{\{CARD_URL\}\}<\/span>/)
  assert.doesNotMatch(template, /property="og:|name="twitter:|rel="canonical"/)
})

test('limits pointer effects and removes decorative movement for reduced motion', () => {
  assert.match(script, /\(hover: hover\) and \(pointer: fine\)/)
  assert.match(script, /prefers-reduced-motion: reduce/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /\.card-stage,\s*\.button,\s*\.action\s*{\s*transform: none !important;/s)
})
