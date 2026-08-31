import { readdirSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const files = []

function collect(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) collect(path)
    else files.push(path)
  }
}

collect(dist)

const sizes = { '.html': 0, '.css': 0, '.js': 0 }
for (const file of files) {
  const extension = extname(file)
  if (extension in sizes) sizes[extension] += statSync(file).size
  if (extension === '.map') throw new Error(`Production source map found: ${file}`)
}

const limits = { '.html': 10 * 1024, '.css': 30 * 1024, '.js': 20 * 1024 }
for (const [extension, limit] of Object.entries(limits)) {
  if (sizes[extension] > limit) {
    throw new Error(`${extension} budget exceeded: ${sizes[extension]} bytes > ${limit} bytes`)
  }
}

console.log(`Budgets: HTML ${sizes['.html']} B, CSS ${sizes['.css']} B, JS ${sizes['.js']} B`)
