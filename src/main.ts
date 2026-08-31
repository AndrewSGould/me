import './style.css'
import { copyValue, shareValue } from './contact-actions.mjs'
import { profile } from './generated/profile.ts'

document.documentElement.classList.remove('no-js')
document.documentElement.classList.add('js')

const status = document.querySelector<HTMLElement>('[data-status]')
const handle = document.querySelector<HTMLElement>('[data-discord-handle]')
const manualCopy = document.querySelector<HTMLElement>('[data-manual-copy]')
const manualUrl = document.querySelector<HTMLElement>('[data-manual-url]')

let statusTimer: number | undefined

function announce(message: string): void {
  if (!status) return
  window.clearTimeout(statusTimer)
  status.textContent = message
  status.classList.add('status-toast--visible')
  statusTimer = window.setTimeout(() => {
    status.classList.remove('status-toast--visible')
  }, 2800)
}

function selectText(element: HTMLElement | null): void {
  if (!element) return
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

const writeText = navigator.clipboard?.writeText.bind(navigator.clipboard)

document.querySelector<HTMLButtonElement>('[data-copy-discord]')?.addEventListener('click', async () => {
  const result = await copyValue(profile.discord.username, {
    writeText,
    selectFallback: () => selectText(handle),
  })
  announce(result === 'copied' ? 'Discord username copied.' : 'Username selected. Copy it from the card.')
})

document.querySelector<HTMLButtonElement>('[data-share-card]')?.addEventListener('click', async () => {
  const result = await shareValue(
    {
      title: `${profile.fullName} — digital business card`,
      text: `Connect with ${profile.fullName}`,
      url: profile.cardUrl,
    },
    {
      share: navigator.share?.bind(navigator),
      writeText,
      revealFallback: () => {
        if (manualCopy) manualCopy.hidden = false
      },
      selectFallback: () => selectText(manualUrl),
    },
  )
  if (result === 'aborted' || result === 'shared') return
  announce(result === 'copied' ? 'Card link copied.' : 'Card link selected. Copy it from the card.')
})

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

if (finePointer.matches && !reducedMotion.matches) {
  const stage = document.querySelector<HTMLElement>('[data-tilt-root]')
  const card = stage?.querySelector<HTMLElement>('.contact-card')
  let frame = 0

  stage?.addEventListener('pointermove', (event) => {
    if (!card) return
    window.cancelAnimationFrame(frame)
    frame = window.requestAnimationFrame(() => {
      const bounds = card.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height
      const rotateX = (0.5 - y) * 6
      const rotateY = (x - 0.5) * 6
      stage.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`)
      stage.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`)
      card.style.setProperty('--spot-x', `${(x * 100).toFixed(1)}%`)
      card.style.setProperty('--spot-y', `${(y * 100).toFixed(1)}%`)
    })
  })

  stage?.addEventListener('pointerleave', () => {
    stage.style.setProperty('--tilt-x', '0deg')
    stage.style.setProperty('--tilt-y', '0deg')
  })

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const bounds = element.getBoundingClientRect()
      const x = Math.max(-4, Math.min(4, (event.clientX - (bounds.left + bounds.width / 2)) * 0.08))
      const y = Math.max(-4, Math.min(4, (event.clientY - (bounds.top + bounds.height / 2)) * 0.08))
      element.style.setProperty('--mag-x', `${x.toFixed(2)}px`)
      element.style.setProperty('--mag-y', `${y.toFixed(2)}px`)
    })
    element.addEventListener('pointerleave', () => {
      element.style.setProperty('--mag-x', '0px')
      element.style.setProperty('--mag-y', '0px')
    })
  })
}

document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('is-hidden', document.hidden)
})
