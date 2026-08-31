export type CopyOptions = Readonly<{
  writeText?: (value: string) => Promise<unknown>
  revealFallback?: () => void
  selectFallback?: () => void
}>

export declare function copyValue(value: string, options: CopyOptions): Promise<'copied' | 'selected'>
