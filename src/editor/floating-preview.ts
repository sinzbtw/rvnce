import type {
  RefObject,
  TargetedKeyboardEvent,
  TargetedPointerEvent,
} from 'preact'
import { useLayoutEffect, useRef } from 'preact/hooks'

const edge = 12
const arrows = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
} as const

export function useFloatingPreview(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  desktop: boolean,
) {
  const offset = useRef({ x: 0, y: 0 })
  const drag = useRef<{
    id: number
    x: number
    y: number
    geometry: ReturnType<typeof geometry>
  } | null>(null)

  function geometry(panel: HTMLElement) {
    const rect = panel.getBoundingClientRect()
    const left = rect.left - offset.current.x
    const top = rect.top - offset.current.y
    return {
      minX: edge - left,
      maxX: document.documentElement.clientWidth - edge - left - rect.width,
      minY: edge - top,
      maxY: document.documentElement.clientHeight - edge - top - rect.height,
    }
  }

  function move(
    panel: HTMLElement,
    bounds: ReturnType<typeof geometry>,
    x: number,
    y: number,
  ) {
    const nextX = Math.round(Math.max(bounds.minX, Math.min(bounds.maxX, x)))
    const nextY = Math.round(Math.max(bounds.minY, Math.min(bounds.maxY, y)))
    offset.current = { x: nextX, y: nextY }
    panel.style.transform =
      nextX || nextY ? `translate3d(${nextX}px, ${nextY}px, 0)` : ''
  }

  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    if (!active || !desktop) {
      drag.current = null
      if (!desktop) panel.style.removeProperty('transform')
      return
    }
    const restore = () => {
      if (!panel.offsetWidth || drag.current) return
      // Restore the saved offset before measuring the default viewport anchor.
      panel.style.transform = `translate3d(${offset.current.x}px, ${offset.current.y}px, 0)`
      move(panel, geometry(panel), offset.current.x, offset.current.y)
    }
    const observer = new ResizeObserver(restore)
    observer.observe(panel)
    window.addEventListener('resize', restore)
    restore()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', restore)
    }
  }, [active, desktop, ref])

  function onPointerDown(event: TargetedPointerEvent<HTMLButtonElement>) {
    const panel = ref.current
    if (!active || !panel || event.button !== 0 || !event.isPrimary) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id: event.pointerId,
      x: event.clientX - offset.current.x,
      y: event.clientY - offset.current.y,
      geometry: geometry(panel),
    }
  }

  function onPointerMove(event: TargetedPointerEvent<HTMLButtonElement>) {
    const panel = ref.current
    const current = drag.current
    if (!panel || !current || current.id !== event.pointerId) return
    move(
      panel,
      current.geometry,
      event.clientX - current.x,
      event.clientY - current.y,
    )
  }

  function onLostPointerCapture(
    event: TargetedPointerEvent<HTMLButtonElement>,
  ) {
    const panel = ref.current
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    if (panel) move(panel, geometry(panel), offset.current.x, offset.current.y)
  }

  function onKeyDown(event: TargetedKeyboardEvent<HTMLButtonElement>) {
    const panel = ref.current
    if (!panel || !active) return
    if (event.key === 'Home' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      move(panel, geometry(panel), 0, 0)
    } else if (Object.hasOwn(arrows, event.key)) {
      event.preventDefault()
      const [x, y] = arrows[event.key as keyof typeof arrows]
      const step = event.shiftKey ? 64 : 16
      move(
        panel,
        geometry(panel),
        offset.current.x + x * step,
        offset.current.y + y * step,
      )
    }
  }

  return { onPointerDown, onPointerMove, onLostPointerCapture, onKeyDown }
}
