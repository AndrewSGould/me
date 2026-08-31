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

export async function shareValue(data, options) {
  if (options.share) {
    try {
      await options.share(data)
      return 'shared'
    } catch (error) {
      if (error && typeof error === 'object' && error.name === 'AbortError') return 'aborted'
    }
  }

  return copyValue(data.url, options)
}
