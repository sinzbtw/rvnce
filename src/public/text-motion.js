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

class ProfileTabTitle extends HTMLElement {
  #events
  #timer
  #original = ''
  #target

  connectedCallback() {
    this.#target = this.hasAttribute('data-published')
      ? document.querySelector('title')
      : this.querySelector('bdi')
    this.#original = this.hasAttribute('data-published')
      ? document.title
      : (this.#target?.textContent.trim() ?? '')
    if (!this.#original || !this.#target) return
    this.#events = new AbortController()
    const { signal } = this.#events
    const refresh = () => {
      this.#restore()
      if (!reducedTextMotion.matches && !document.hidden) this.#play()
    }
    document.addEventListener('visibilitychange', refresh, { signal })
    reducedTextMotion.addEventListener('change', refresh, { signal })
    refresh()
  }

  disconnectedCallback() {
    this.#events?.abort()
    this.#restore()
  }

  #restore() {
    clearTimeout(this.#timer)
    if (this.#target) this.#target.textContent = this.#original
  }

  #play() {
    const letters = Array.from(
      graphemeSegmenter.segment(this.#original),
      ({ segment }) => segment,
    )
    const typing = this.dataset.motion === 'typewriter'
    const delay =
      (typing ? 145 : 275) - Number(this.dataset.speed) * (typing ? 1.05 : 1.8)
    const loop = [...letters, ' ', '·', ' ', ...letters]
    const visible = Math.min(letters.length, 22)
    let step = 0
    const advance = () => {
      if (typing) {
        step = (step % letters.length) + 1
        this.#target.textContent = letters.slice(0, step).join('')
      } else {
        step = (step + 1) % (letters.length + 3)
        this.#target.textContent = step
          ? loop.slice(step, step + visible).join('')
          : this.#original
      }
      const fullTitle = typing ? step === letters.length : step === 0
      this.#timer = setTimeout(advance, fullTitle ? 1550 : delay)
    }
    this.#timer = setTimeout(advance, 650)
  }
}

customElements.define('rvnce-tab-title', ProfileTabTitle)
