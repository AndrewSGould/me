export async function copyValue(value, options) {
  try {
    if (!options.writeText) throw new Error('Clipboard API unavailable.')
    await options.writeText(value)
    return 'copied'
  } catch {
    options.revealFallback?.()
    options.selectFallback?.()
    return 'selected'
  }
}
