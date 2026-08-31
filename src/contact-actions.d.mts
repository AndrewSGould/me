export type CopyOptions = Readonly<{
  writeText?: (value: string) => Promise<unknown>
  revealFallback?: () => void
  selectFallback?: () => void
}>

export type CardShareData = Readonly<{
  title?: string
  text?: string
  url: string
}>

export type ShareOptions = CopyOptions &
  Readonly<{
    share?: (data: CardShareData) => Promise<unknown>
  }>

export declare function copyValue(value: string, options: CopyOptions): Promise<'copied' | 'selected'>

export declare function shareValue(
  data: CardShareData,
  options: ShareOptions,
): Promise<'shared' | 'aborted' | 'copied' | 'selected'>
