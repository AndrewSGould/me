import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { escapeHtml, makeQrArtifacts, makeVcard, validateProfile } from './profile-tools.mjs'

const root = resolve(import.meta.dirname, '..')
const permanentCardUrlSha256 = 'b4ad5e3c8aa7a16a4cf1a13f88085d80c4cc398fdbefaee75fd75ef9547f3124'
const mode = process.argv.includes('--production')
  ? 'production'
  : process.argv.includes('--dev')
    ? 'dev'
    : 'build'

function parseProfileJson(raw, sourceLabel) {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`${sourceLabel} does not contain valid JSON.`)
  }
}

function readProfile() {
  if (process.env.CARD_PROFILE_JSON) {
    return { input: parseProfileJson(process.env.CARD_PROFILE_JSON, 'CARD_PROFILE_JSON'), source: 'environment' }
  }
  if (mode === 'production') {
    throw new Error('CARD_PROFILE_JSON is required for a production build.')
  }

  try {
    return {
      input: parseProfileJson(readFileSync(resolve(root, '.profile.local.json'), 'utf8'), 'Local profile'),
      source: 'local',
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return {
      input: parseProfileJson(readFileSync(resolve(root, 'profile.example.json'), 'utf8'), 'Example profile'),
      source: 'example',
    }
  }
}

const loaded = readProfile()
const profile = validateProfile(loaded.input)
if (
  loaded.source !== 'example' &&
  createHash('sha256').update(profile.cardUrl).digest('hex') !== permanentCardUrlSha256
) {
  throw new Error('cardUrl does not match the permanent production card URL.')
}
const fileSlug = `${profile.givenName}-${profile.familyName}`.replaceAll(/[^A-Za-z0-9-]/g, '-')
const vcardFileName = `${fileSlug}.vcf`
const discordDeepLink = `discord://-/users/${profile.discord.userId}`
const csp = mode === 'dev'
  ? "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  : "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

const replacements = {
  CSP: csp,
  FULL_NAME: profile.fullName,
  DISPLAY_NAME: profile.discord.displayName,
  ROLE_1_MARK: profile.roles[0].mark,
  ROLE_1_TITLE: profile.roles[0].title,
  ROLE_1_ORGANIZATION: profile.roles[0].organization,
  ROLE_2_MARK: profile.roles[1].mark,
  ROLE_2_TITLE: profile.roles[1].title,
  ROLE_2_ORGANIZATION: profile.roles[1].organization,
  DISCORD_USERNAME: profile.discord.username,
  DISCORD_DEEP_LINK: discordDeepLink,
  VCARD_PATH: `/me/${vcardFileName}`,
  MAILTO_URL: `mailto:${profile.email}`,
  EMAIL: profile.email,
  LINKEDIN_URL: profile.linkedinUrl,
  CARD_URL: profile.cardUrl,
  CARD_URL_DISPLAY: profile.cardUrl.replace(/^https:\/\//, ''),
}

const template = readFileSync(resolve(root, 'index.template.html'), 'utf8')
const html = template.replaceAll(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
  if (!(key in replacements)) throw new Error(`Unknown template token: ${key}`)
  return escapeHtml(replacements[key])
})
if (/\{\{[A-Z0-9_]+\}\}/.test(html)) throw new Error('Unresolved template token found.')

mkdirSync(resolve(root, 'src', 'generated'), { recursive: true })
writeFileSync(resolve(root, 'index.html'), html)
writeFileSync(
  resolve(root, 'src', 'generated', 'profile.ts'),
  `import type { CardProfile } from '../profile.ts'\n\nexport const profile = ${JSON.stringify(profile, null, 2)} as const satisfies CardProfile\n`,
)
writeFileSync(resolve(root, 'public', vcardFileName), makeVcard(profile))

if (loaded.source !== 'example') {
  const qr = makeQrArtifacts(profile.cardUrl)
  const qrOutput = resolve(root, 'output', 'qr')
  mkdirSync(qrOutput, { recursive: true })
  writeFileSync(resolve(qrOutput, `${fileSlug}-QR.svg`), qr.svg)
  writeFileSync(
    resolve(qrOutput, 'print-manifest.json'),
    JSON.stringify(
      {
        fullName: profile.fullName,
        email: profile.email,
        roles: profile.roles,
        svgFileName: `${fileSlug}-QR.svg`,
        qr: qr.manifest,
        matrix: qr.matrix,
      },
      null,
      2,
    ),
  )
}
