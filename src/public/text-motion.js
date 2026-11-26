const reducedTextMotion = matchMedia('(prefers-reduced-motion: reduce)')
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

class ProfileNameMotion extends HTMLElement {
  #events
  #frame = 0
  #pulse
  #text
  #caret

  connectedCallback() {
    this.#text = this.querySelector('.profile-name-text')
    if (!this.#text || reducedTextMotion.matches) return
    this.#events = new AbortController()
    const { signal } = this.#events
    reducedTextMotion.addEventListener('change', () => this.#finish(), {
      signal,
    })
    window.addEventListener('resize', () => this.#finish(), { signal })
    this.#frame = requestAnimationFrame((now) => this.#play(now))
  }

  disconnectedCallback() {
    this.#finish()
  }

  #finish() {
    this.#events?.abort()
    cancelAnimationFrame(this.#frame)
    this.#pulse?.cancel()
    this.#text?.style.removeProperty('clip-path')
    this.#caret?.remove()
    this.#caret = undefined
  }

  #play(start) {
    const text = this.#text.firstChild
    if (!(text instanceof Text)) return
    const speed = Number(this.dataset.speed) / 100
    if (this.dataset.motion === 'pulse') {
      this.#pulse = this.#text.animate(
        [{ opacity: 1 }, { opacity: 0.48 }, { opacity: 1 }],
        { duration: 1550 - speed * 840, easing: 'ease-in-out' },
      )
      this.#pulse.addEventListener('finish', () => this.#finish(), {
        once: true,
      })
      return
    }

    const range = document.createRange()
    const bounds = this.#text.getBoundingClientRect()
    const lines = Array.from(
      graphemeSegmenter.segment(text.data),
      ({ index, segment }) => {
        range.setStart(text, index)
        range.setEnd(text, index + segment.length)
        const rectangles = Array.from(
          range.getClientRects(),
          ({ x, y, width, height }) => ({
            x: x - bounds.x,
            y: y - bounds.y,
            width,
            height,
          }),
        )
        range.collapse(false)
        const caret = range.getBoundingClientRect()
        return { rectangles, caret }
      },
    )
    if (!lines.length || !bounds.width) return
    const typing = this.dataset.motion === 'typewriter'
    if (typing && this.dataset.caret === 'true') {
      this.#caret = document.createElement('span')
      this.#caret.className = 'profile-name-caret'
      this.#caret.setAttribute('aria-hidden', 'true')
      this.append(this.#caret)
    }
    const step = typing ? 124 - speed * 97 : 62 - speed * 45
    const reveal = typing ? 0 : 180
    const finishAt = lines.length * step + reveal
    const placeCaret = (count) => {
      const active = lines[count - 1]?.caret
      if (!this.#caret || !active) return
      this.#caret.style.transform =
        'translate(' +
        (active.x - bounds.x) +
        'px,' +
        (active.y - bounds.y) +
        'px)'
      this.#caret.style.height = active.height + 'px'
    }
    let shown = -1
    const draw = (now) => {
      const elapsed = now - start
      if (elapsed >= finishAt + (this.#caret ? 850 : 0)) {
        this.#finish()
        return
      }
      const count = Math.min(lines.length, Math.floor(elapsed / step) + 1)
      if (count !== shown || (!typing && elapsed < finishAt)) {
        shown = count
        if (elapsed >= finishAt || (typing && count === lines.length))
          this.#text.style.removeProperty('clip-path')
        else {
          const areas = lines
            .slice(0, count)
            .flatMap(({ rectangles }, index) => {
              const progress = typing
                ? 1
                : Math.min(1, (elapsed - index * step) / reveal)
              return rectangles.map(({ x, y, width, height }) => {
                const bottom = y + height + 5
                return (
                  'M ' +
                  (x - 1) +
                  ' ' +
                  (bottom - (height + 10) * progress) +
                  ' h ' +
                  (width + 2) +
                  ' V ' +
                  bottom +
                  ' h ' +
                  (-width - 2) +
                  ' Z'
                )
              })
            })
          this.#text.style.clipPath = 'path("' + areas.join(' ') + '")'
        }
        placeCaret(count)
      }
      this.#frame = requestAnimationFrame(draw)
    }
    draw(start)
  }
}

customElements.define('rvnce-name', ProfileNameMotion)
