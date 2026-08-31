import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateProfile } from './profile-tools.mjs'

const root = resolve(import.meta.dirname, '..')
const rawProfile = process.env.CARD_PROFILE_JSON
if (!rawProfile) throw new Error('CARD_PROFILE_JSON is required for the production source check.')

let input
try {
  input = JSON.parse(rawProfile)
} catch {
  throw new Error('CARD_PROFILE_JSON does not contain valid JSON.')
}

const profile = validateProfile(input)
const protectedValues = new Set(
  [
    profile.fullName,
    profile.givenName,
    profile.familyName,
    profile.email,
    profile.linkedinUrl,
    profile.cardUrl,
    profile.discord.displayName,
    profile.discord.username,
    profile.discord.userId,
    ...profile.roles.flatMap((role) => [role.title, role.organization]),
  ],
)

const sourceFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean)

for (const file of sourceFiles) {
  const sourcePath = resolve(root, file)
  if (!existsSync(sourcePath)) continue
  const contents = readFileSync(sourcePath)
  for (const value of protectedValues) {
    const valueBytes = Buffer.from(value, 'utf8')
    const appears = valueBytes.length >= 4
      ? contents.includes(valueBytes)
      : new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(value)}(?![\\p{L}\\p{N}_])`, 'u')
          .test(contents.toString('utf8'))
    if (appears) {
      throw new Error('A production profile value appears in repository source.')
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
