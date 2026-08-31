import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolve } from 'node:path'
import { Bitmap } from 'qr'
import decodeQR from 'qr/decode.js'
import {
  escapeHtml,
  foldVcardLine,
  makeQrArtifacts,
  makeVcard,
  validateProfile,
  vcardEscape,
} from '../scripts/profile-tools.mjs'

const example = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'profile.example.json'), 'utf8'))

test('validates the example profile and rejects insecure URLs', () => {
  const profile = validateProfile(example)
  assert.equal(profile.roles.length, 2)
  assert.throws(() => validateProfile({ ...example, cardUrl: 'http://example.com/' }), /HTTPS/)
  const secretUrl = 'PROFILE_VALUE_MUST_NOT_APPEAR'
  assert.throws(
    () => validateProfile({ ...example, cardUrl: secretUrl }),
    (error) => error instanceof Error && !error.message.includes(secretUrl),
  )
})

test('production generation is fail-closed and does not echo malformed profile JSON', () => {
  const generator = resolve(import.meta.dirname, '..', 'scripts', 'generate-profile.mjs')
  const cleanEnvironment = { ...process.env }
  delete cleanEnvironment.CARD_PROFILE_JSON

  const missing = spawnSync(process.execPath, [generator, '--production'], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: cleanEnvironment,
  })
  assert.notEqual(missing.status, 0)
  assert.match(`${missing.stdout}${missing.stderr}`, /CARD_PROFILE_JSON is required/)

  const sentinel = 'PROFILE_JSON_LEAK_SENTINEL'
  const malformed = spawnSync(process.execPath, [generator, '--production'], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: { ...cleanEnvironment, CARD_PROFILE_JSON: `{"fullName":"${sentinel}"` },
  })
  assert.notEqual(malformed.status, 0)
  assert.doesNotMatch(`${malformed.stdout}${malformed.stderr}`, new RegExp(sentinel))
  assert.match(`${malformed.stdout}${malformed.stderr}`, /does not contain valid JSON/)

  const wrongUrl = spawnSync(process.execPath, [generator, '--production'], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: { ...cleanEnvironment, CARD_PROFILE_JSON: JSON.stringify(example) },
  })
  assert.notEqual(wrongUrl.status, 0)
  assert.doesNotMatch(`${wrongUrl.stdout}${wrongUrl.stderr}`, new RegExp(example.cardUrl))
  assert.match(`${wrongUrl.stdout}${wrongUrl.stderr}`, /does not match the permanent production card URL/)
})

test('source leak checking reports generically without echoing profile values', () => {
  const checker = resolve(import.meta.dirname, '..', 'scripts', 'check-profile-source.mjs')
  const checked = spawnSync(process.execPath, [checker], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, CARD_PROFILE_JSON: JSON.stringify(example) },
  })
  const output = `${checked.stdout}${checked.stderr}`
  assert.notEqual(checked.status, 0)
  assert.match(output, /production profile value appears in repository source/i)
  assert.doesNotMatch(output, /Alex Morgan|alex@example\.com|alex_example/)
})

test('escapes HTML and vCard text safely', () => {
  assert.equal(escapeHtml('<a title="x">&</a>'), '&lt;a title=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  assert.equal(vcardEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne')
  assert.equal(vcardEscape('one\r\ntwo\rthree\nfour'), 'one\\ntwo\\nthree\\nfour')
})

test('folds vCard lines at 75 UTF-8 bytes without splitting Unicode', () => {
  const folded = foldVcardLine(`NOTE:${'é'.repeat(60)}`)
  for (const line of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
  }
  assert.match(folded, /\r\n /)
})

test('creates a portable role-neutral vCard', () => {
  const profile = validateProfile(example)
  const vcard = makeVcard(profile)
  const unfolded = vcard.replaceAll('\r\n ', '')
  assert.ok(vcard.endsWith('END:VCARD\r\n'))
  assert.equal(vcard.charCodeAt(0), 'B'.charCodeAt(0))
  assert.doesNotMatch(vcard, /(?<!\r)\n|\r(?!\n)/)
  assert.doesNotMatch(vcard, /\r\n(?:ORG|TITLE|ROLE|PHOTO|LOGO|X-)/)
  assert.match(unfolded, /FN:Alex Morgan\r\n/)
  assert.match(unfolded, /N:Morgan;Alex;;;\r\n/)
  assert.match(unfolded, /NICKNAME:alex\r\n/)
  assert.match(unfolded, /EMAIL;TYPE=INTERNET,WORK,PREF:alex@example\.com\r\n/)
  assert.match(unfolded, /URL:https:\/\/example\.github\.io\/me\/\r\n/)
  assert.match(unfolded, /URL:https:\/\/www\.linkedin\.com\/in\/example\r\n/)
  assert.match(unfolded, /Product Engineer - Company One/)
  assert.match(unfolded, /Digital Programs Lead - Organization Two/)
  assert.match(unfolded, /Discord: alex_example/)
  assert.equal(makeVcard(profile), vcard)
  for (const line of vcard.split('\r\n').slice(0, -1)) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
  }
})

test('normalizes embedded contact newlines before vCard serialization', () => {
  const profile = validateProfile({
    ...example,
    roles: [{ ...example.roles[0], title: 'First\r\nSecond\rThird' }, example.roles[1]],
  })
  const vcard = makeVcard(profile)
  assert.doesNotMatch(vcard, /(?<!\r)\n|\r(?!\n)/)
  assert.match(vcard.replaceAll('\r\n ', ''), /First\\nSecond\\nThird/)
})

test('preserves validated URI punctuation in vCard URL properties', () => {
  const profile = validateProfile({ ...example, cardUrl: 'https://example.com/a,b;c' })
  const vcard = makeVcard(profile).replaceAll('\r\n ', '')
  assert.match(vcard, /URL:https:\/\/example\.com\/a,b;c\r\n/)
  assert.doesNotMatch(vcard, /URL:https:\/\/example\.com\/a\\,b\\;c/)
})

test('creates an opaque 30 mm Version 4-H QR with a four-module quiet zone', () => {
  const prefix = 'https://example.test/'
  const payload = prefix + 'x'.repeat(34 - Buffer.byteLength(prefix))
  assert.equal(Buffer.byteLength(payload), 34)
  const qr = makeQrArtifacts(payload)
  assert.equal(qr.matrix.length, 41)
  assert.equal(qr.manifest.payload, payload)
  assert.equal(qr.manifest.version, 4)
  assert.equal(qr.manifest.errorCorrection, 'H')
  assert.match(qr.manifest.matrixSha256, /^[a-f0-9]{64}$/)
  assert.match(qr.svg, /width="30mm" height="30mm"/)
  assert.match(qr.svg, /<rect width="41" height="41" fill="#fff"\/>/)
  assert.match(qr.svg, /<path fill="#000"/)
  for (let y = 0; y < 41; y += 1) {
    for (let x = 0; x < 41; x += 1) {
      if (x < 4 || y < 4 || x >= 37 || y >= 37) assert.equal(qr.matrix[y][x], false)
    }
  }
  assert.equal(makeQrArtifacts(payload).manifest.svgSha256, qr.manifest.svgSha256)
  const bitmap = new Bitmap({ width: 41, height: 41 }, qr.matrix)
  assert.equal(decodeQR(bitmap.toImage()), payload)
  assert.throws(() => makeQrArtifacts(`${payload}x`), /capacity|version|data|length/i)
})
