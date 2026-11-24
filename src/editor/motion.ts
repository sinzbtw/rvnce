import { animate } from 'motion/mini'
import type { RefObject } from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

const ease = [0.23, 1, 0.32, 1] as const
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
type Playback = ReturnType<typeof animate>

export function usePanelMotion(
  ref: RefObject<HTMLElement | null>,
  state: string | null,
  duration: number,
) {
  const prior = useRef(state)
  const playing = useRef<Playback | null>(null)

  useLayoutEffect(() => {
    if (prior.current === state) return
    prior.current = state
    const panel = ref.current
    const style = panel && playing.current ? getComputedStyle(panel) : null
    const opacity = style?.opacity ?? '0.76'
    const transform = style?.transform ?? 'translateY(6px)'
    playing.current?.cancel()
    playing.current = null
    if (!panel || !state || reduced()) return
    const motion = animate(
      panel,
      { opacity: [opacity, '1'], transform: [transform, 'none'] },
      { duration, ease: [...ease] },
    )
    playing.current = motion
    void motion.then(() => {
      if (playing.current === motion) playing.current = null
    })
  }, [duration, ref, state])

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => {
      if (!preference.matches) return
      playing.current?.cancel()
      playing.current = null
    }
    preference.addEventListener('change', change)
    return () => {
      preference.removeEventListener('change', change)
      playing.current?.cancel()
    }
  }, [])
}

type LinkPositions = Map<string, number>

export function useLinkMotion(
  ref: RefObject<HTMLElement | null>,
  blocks: readonly unknown[],
) {
  const before = useRef<LinkPositions | null>(null)
  const playing = useRef(new Map<HTMLElement, Playback>())
  const exits = useRef(new Map<HTMLElement, Playback>())

  const rows = () =>
    ref.current?.querySelectorAll<HTMLElement>('[data-link-row]') ?? []

  function capture(removed?: string) {
    if (!ref.current || reduced()) return
    const positions: LinkPositions = new Map()
    for (const row of rows()) {
      const id = row.dataset.linkRow!
      const rect = row.getBoundingClientRect()
      positions.set(id, rect.top)
      if (id !== removed) continue

      const exit = row.cloneNode(true) as HTMLElement
      exit.inert = true
      exit.removeAttribute('data-link-row')
      exit.setAttribute('aria-hidden', 'true')
      exit
        .querySelectorAll('[id]')
        .forEach((item) => item.removeAttribute('id'))
      exit.classList.add('link-exit')
      Object.assign(exit.style, {
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
      })
      document.body.append(exit)
      const motion = animate(
        exit,
        { opacity: [1, 0], transform: ['none', 'translateY(-4px)'] },
        { duration: 0.14, ease: [...ease] },
      )
      exits.current.set(exit, motion)
      void motion.then(() => {
        exit.remove()
        exits.current.delete(exit)
      })
    }
    before.current = positions
  }

  useLayoutEffect(() => {
    const positions = before.current
    before.current = null
    if (!positions) return
    for (const motion of playing.current.values()) motion.cancel()
    playing.current.clear()
    if (reduced()) return
    for (const row of rows()) {
      const start = positions.get(row.dataset.linkRow!)
      const offset =
        start === undefined ? 6 : start - row.getBoundingClientRect().top
      if (Math.abs(offset) < 1) continue
      const motion = animate(
        row,
        {
          transform: ['translateY(' + offset + 'px)', 'none'],
          ...(start === undefined ? { opacity: [0.72, 1] } : {}),
        },
        { duration: 0.19, ease: [...ease] },
      )
      playing.current.set(row, motion)
      void motion.then(() => {
        if (playing.current.get(row) === motion) playing.current.delete(row)
      })
    }
  }, [blocks])

  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)')
    const cancel = () => {
      before.current = null
      for (const motion of playing.current.values()) motion.cancel()
      playing.current.clear()
      for (const [exit, motion] of exits.current) {
        motion.cancel()
        exit.remove()
      }
      exits.current.clear()
    }
    const change = () => {
      if (preference.matches) cancel()
    }
    preference.addEventListener('change', change)
    return () => {
      preference.removeEventListener('change', change)
      cancel()
    }
  }, [])

  return capture
}
