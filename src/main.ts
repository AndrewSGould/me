import './style.css'
import { copyValue } from './contact-actions.mjs'
import { profile } from './generated/profile.ts'

document.documentElement.classList.remove('no-js')
document.documentElement.classList.add('js')

const status = document.querySelector<HTMLElement>('[data-status]')
const handle = document.querySelector<HTMLElement>('[data-discord-handle]')
const copyDiscordControl = document.querySelector<HTMLButtonElement>('[data-copy-discord]')
const showQrControl = document.querySelector<HTMLAnchorElement>('[data-show-qr]')
const qrDialog = document.querySelector<HTMLDialogElement>('[data-qr-dialog]')

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

copyDiscordControl?.addEventListener('click', async () => {
  const result = await copyValue(profile.discord.username, {
    writeText,
    selectFallback: () => selectText(handle),
  })
  if (result === 'copied') {
    copyDiscordControl.classList.remove('is-copy-confirmed')
    void copyDiscordControl.offsetWidth
    copyDiscordControl.classList.add('is-copy-confirmed')
  }
  announce(result === 'copied' ? 'Discord username copied.' : 'Username selected. Copy it from the card.')
})

copyDiscordControl?.addEventListener('animationend', (event) => {
  if (event.animationName === 'copy-confirmation') {
    copyDiscordControl.classList.remove('is-copy-confirmed')
  }
})

showQrControl?.addEventListener('click', (event) => {
  if (!qrDialog || typeof qrDialog.showModal !== 'function') return
  event.preventDefault()
  if (!qrDialog.open) qrDialog.showModal()
})

qrDialog?.addEventListener('click', (event) => {
  if (event.target === qrDialog) qrDialog.close()
})

qrDialog?.addEventListener('close', () => {
  showQrControl?.focus({ preventScroll: true })
})

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

if (finePointer.matches && !reducedMotion.matches) {
  const stage = document.querySelector<HTMLElement>('[data-tilt-root]')
  const card = stage?.querySelector<HTMLElement>('.contact-card')
  let pointerFrame = 0
  let settleFrame = 0
  let spotX = 0.5
  let spotY = 0.1

  const setSpotlightPosition = (x: number, y: number): void => {
    if (!card) return
    spotX = x
    spotY = y
    card.style.setProperty('--spot-x', `${(x * 100).toFixed(1)}%`)
    card.style.setProperty('--spot-y', `${(y * 100).toFixed(1)}%`)
  }

  stage?.addEventListener('pointerenter', () => {
    window.cancelAnimationFrame(settleFrame)
    stage.classList.add('is-spotlight-tracking')
  })

  stage?.addEventListener('pointermove', (event) => {
    if (!card) return
    window.cancelAnimationFrame(pointerFrame)
    pointerFrame = window.requestAnimationFrame(() => {
      const bounds = card.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height
      const rotateX = (0.5 - y) * 6
      const rotateY = (x - 0.5) * 6
      stage.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`)
      stage.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`)
      setSpotlightPosition(x, y)
    })
  })

  stage?.addEventListener('pointerleave', () => {
    window.cancelAnimationFrame(pointerFrame)
    window.cancelAnimationFrame(settleFrame)
    stage.style.setProperty('--tilt-x', '0deg')
    stage.style.setProperty('--tilt-y', '0deg')

    const startX = spotX
    const startY = spotY
    const settleDuration = 700
    const startedAt = performance.now()

    const settleSpotlight = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / settleDuration)
      const eased = 1 - (1 - progress) ** 3
      setSpotlightPosition(startX + (0.5 - startX) * eased, startY + (0.1 - startY) * eased)

      if (progress < 1) {
        settleFrame = window.requestAnimationFrame(settleSpotlight)
        return
      }

      card?.style.removeProperty('--spot-x')
      card?.style.removeProperty('--spot-y')
      stage.classList.remove('is-spotlight-tracking')
    }

    settleFrame = window.requestAnimationFrame(settleSpotlight)
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
