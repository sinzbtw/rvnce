class ProfilePointer extends HTMLElement {
  #events
  #lastPoint
  #lastClick = -Infinity
  #lastTrail = -Infinity

  connectedCallback() {
    const profile = this.parentElement
    if (!profile) return
    this.#events = new AbortController()
    const { signal } = this.#events
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener(
      'change',
      () => {
        this.replaceChildren()
        this.#lastPoint = undefined
        this.#lastTrail = -Infinity
      },
      { signal },
    )
    profile.addEventListener(
      'click',
      (event) => {
        const effect = this.dataset.click
        if (
          !motion.matches &&
          event.detail &&
          effect !== 'none' &&
          event.timeStamp - this.#lastClick >= 84
        ) {
          this.#lastClick = event.timeStamp
          this.#show(
            event.clientX,
            event.clientY,
            effect,
            profile,
            this.getBoundingClientRect(),
            event.timeStamp,
          )
        }
      },
      { passive: true, signal },
    )
    profile.addEventListener(
      'pointermove',
      (event) => {
        const trail = this.dataset.trail
        if (
          motion.matches ||
          event.pointerType !== 'mouse' ||
          trail === 'none' ||
          event.buttons
        )
          return
        if (
          trail === 'ghost' &&
          event.target instanceof Element &&
          event.target.closest(
            '.profile-link, .profile-social-link, .profile-name, .profile-bio, button, a',
          )
        ) {
          this.#lastPoint = undefined
          return
        }
        const last = this.#lastPoint
        const { clientX: x, clientY: y, timeStamp } = event
        if (timeStamp - this.#lastTrail < 20) return
        const dx = last ? x - last.x : 0
        const dy = last ? y - last.y : 0
        const distance = Math.hypot(dx, dy)
        const spacing = trail === 'ghost' ? 12 : 17
        if (last && distance < spacing) return
        const marks = Math.min(4, Math.max(1, Math.floor(distance / spacing)))
        const bounds = this.getBoundingClientRect()
        for (let index = marks - 1; index >= 0; index--) {
          const step = distance ? (index * spacing) / distance : 0
          this.#show(
            x - dx * step,
            y - dy * step,
            trail === 'ghost' ? 'ghost' : 'trail-sparkles',
            profile,
            bounds,
            timeStamp,
          )
        }
        this.#lastPoint = { x, y }
        this.#lastTrail = timeStamp
      },
      { passive: true, signal },
    )
    profile.addEventListener(
      'pointerleave',
      () => {
        this.#lastPoint = undefined
      },
      { passive: true, signal },
    )
  }

  disconnectedCallback() {
    this.#events?.abort()
    this.#lastPoint = undefined
    this.replaceChildren()
  }

  #show(x, y, effect, profile, container, time) {
    const particle = document.createElement('span')
    particle.className = 'profile-pointer-mark'
    particle.dataset.effect = effect
    if (effect === 'ghost') particle.dataset.cursor = profile.dataset.cursor
    particle.style.left = x - container.left + 'px'
    particle.style.top = y - container.top + 'px'
    if (effect === 'burst' || effect === 'sparkles') {
      const count = effect === 'burst' ? 8 : 5
      for (let index = 0; index < count; index++) {
        const fragment = document.createElement('i')
        const angle = (index * 2 * Math.PI) / count + (time % 15)
        const distance = 14 + (index % 3) * 7
        fragment.style.setProperty(
          '--mark-x',
          Math.cos(angle) * distance + 'px',
        )
        fragment.style.setProperty(
          '--mark-y',
          Math.sin(angle) * distance + 'px',
        )
        particle.append(fragment)
      }
    }
    particle.addEventListener('animationend', (event) => {
      if (event.target === particle) particle.remove()
    })
    if (this.childElementCount >= 24) this.firstElementChild.remove()
    this.append(particle)
  }
}

customElements.define('rvnce-pointer', ProfilePointer)
