import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const cardHtmlPath = resolve(dist, 'me', 'index.html')
const cardHtml = readFileSync(cardHtmlPath, 'utf8')
const htmlBytes = statSync(cardHtmlPath).size
const referencedAssets = new Set()

for (const match of cardHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
  const resource = new URL(match[1], 'https://site.invalid/me/')
  if (resource.origin !== 'https://site.invalid') continue
  const extension = extname(resource.pathname)
  if (extension === '.css' || extension === '.js') {
    referencedAssets.add(resolve(dist, decodeURIComponent(resource.pathname).replace(/^\//, '')))
  }
}

const sizes = { '.css': 0, '.js': 0 }
for (const file of referencedAssets) sizes[extname(file)] += statSync(file).size

function rejectSourceMaps(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) rejectSourceMaps(path)
    else if (extname(path) === '.map') throw new Error('Production source map found: ' + path)
  }
}
rejectSourceMaps(dist)

const limits = { '.html': 10 * 1024, '.css': 30 * 1024, '.js': 20 * 1024 }
if (htmlBytes >= limits['.html']) {
  throw new Error('Card HTML budget exceeded: ' + htmlBytes + ' bytes >= ' + limits['.html'] + ' bytes')
}
for (const extension of ['.css', '.js']) {
  if (sizes[extension] >= limits[extension]) {
    throw new Error(
      'Card ' + extension + ' budget exceeded: ' + sizes[extension] + ' bytes >= ' + limits[extension] + ' bytes',
    )
  }
}

console.log('Card budgets: HTML ' + htmlBytes + ' B, CSS ' + sizes['.css'] + ' B, JS ' + sizes['.js'] + ' B')
