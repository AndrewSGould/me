import { createHash } from 'node:crypto'
import encodeQR from 'qr'

function requiredString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string.`)
  }
  return value.trim()
}

function secureUrl(value, path) {
  let url
  try {
    url = new URL(requiredString(value, path))
  } catch {
    throw new TypeError(`${path} must be a valid HTTPS URL.`)
  }
  if (url.protocol !== 'https:') throw new TypeError(`${path} must use HTTPS.`)
  return url.href
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Profile must be an object.')
  if (!Array.isArray(input.roles) || input.roles.length !== 2) {
    throw new TypeError('roles must contain exactly two entries.')
  }

  const roles = input.roles.map((role, index) => ({
    mark: requiredString(role?.mark, `roles[${index}].mark`),
    title: requiredString(role?.title, `roles[${index}].title`),
    organization: requiredString(role?.organization, `roles[${index}].organization`),
  }))
  if (roles.some((role) => role.mark.length > 3)) throw new TypeError('Role marks must be at most 3 characters.')

  const email = requiredString(input.email, 'email')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError('email is not valid.')

  const userId = requiredString(input.discord?.userId, 'discord.userId')
  if (!/^\d{16,20}$/.test(userId)) throw new TypeError('discord.userId must be a Discord snowflake.')

  return {
    fullName: requiredString(input.fullName, 'fullName'),
    givenName: requiredString(input.givenName, 'givenName'),
    familyName: requiredString(input.familyName, 'familyName'),
    roles,
    email,
    linkedinUrl: secureUrl(input.linkedinUrl, 'linkedinUrl'),
    cardUrl: secureUrl(input.cardUrl, 'cardUrl'),
    discord: {
      displayName: requiredString(input.discord?.displayName, 'discord.displayName'),
      username: requiredString(input.discord?.username, 'discord.username'),
      userId,
    },
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function vcardEscape(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(/\r\n?|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

export function foldVcardLine(line) {
  const physicalLines = []
  let current = ''
  for (const character of line) {
    const candidate = current + character
    if (Buffer.byteLength(candidate, 'utf8') > 75) {
      physicalLines.push(current)
      current = ` ${character}`
    } else {
      current = candidate
    }
  }
  physicalLines.push(current)
  return physicalLines.join('\r\n')
}

export function makeVcard(profile) {
  const note = [
    'Roles:',
    `${profile.roles[0].title} - ${profile.roles[0].organization}`,
    `${profile.roles[1].title} - ${profile.roles[1].organization}`,
    `Discord: ${profile.discord.username}`,
  ].join('\n')

  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${vcardEscape(profile.fullName)}`,
    `N:${vcardEscape(profile.familyName)};${vcardEscape(profile.givenName)};;;`,
    `NICKNAME:${vcardEscape(profile.discord.displayName)}`,
    `EMAIL;TYPE=INTERNET,WORK,PREF:${vcardEscape(profile.email)}`,
    `URL:${profile.cardUrl}`,
    `URL:${profile.linkedinUrl}`,
    `NOTE:${vcardEscape(note)}`,
    'END:VCARD',
  ]
    .map(foldVcardLine)
    .join('\r\n') + '\r\n'
}

export function makeQrArtifacts(payload) {
  const options = { ecc: 'high', encoding: 'byte', version: 4, border: 4 }
  const matrix = encodeQR(payload, 'raw', options)
  if (matrix.length !== 41 || matrix.some((row) => row.length !== 41)) {
    throw new Error('Expected a 41 by 41 Version 4 QR canvas including quiet zone.')
  }

  for (let y = 0; y < 41; y += 1) {
    for (let x = 0; x < 41; x += 1) {
      if ((x < 4 || y < 4 || x >= 37 || y >= 37) && matrix[y][x]) {
        throw new Error('QR quiet zone must remain four clear modules on every side.')
      }
    }
  }

  const encoded = encodeQR(payload, 'svg', options)
  const svg = encoded
    .replace(
      '<svg viewBox="0 0 41 41" xmlns="http://www.w3.org/2000/svg">',
      '<svg width="30mm" height="30mm" viewBox="0 0 41 41" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="41" height="41" fill="#fff"/>',
    )
    .replace('<path ', '<path fill="#000" ')

  const matrixSha256 = createHash('sha256').update(JSON.stringify(matrix)).digest('hex')

  return {
    matrix,
    svg,
    manifest: {
      payload,
      encoding: 'byte',
      version: 4,
      errorCorrection: 'H',
      symbolModules: 33,
      quietZoneModules: 4,
      canvasModules: 41,
      overallSizeMm: 30,
      moduleSizeMm: 30 / 41,
      matrixSha256,
      svgSha256: createHash('sha256').update(svg).digest('hex'),
    },
  }
}
