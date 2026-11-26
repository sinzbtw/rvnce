class ProfilePointer extends HTMLElement {
  #events
  #lastPoint
  #lastClick = -Infinity

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
          this.#show(event, effect, profile)
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
        const last = this.#lastPoint
        if (
          last &&
          (event.timeStamp - last.time < 42 ||
            Math.hypot(event.clientX - last.x, event.clientY - last.y) < 10)
        )
          return
        this.#lastPoint = {
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        }
        this.#show(
          event,
          trail === 'ghost' ? 'ghost' : 'trail-sparkles',
          profile,
        )
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

  #show(event, effect, profile) {
    const container = this.getBoundingClientRect()
    const particle = document.createElement('span')
    particle.className = 'profile-pointer-mark'
    particle.dataset.effect = effect
    if (effect === 'ghost') particle.dataset.cursor = profile.dataset.cursor
    particle.style.left = event.clientX - container.left + 'px'
    particle.style.top = event.clientY - container.top + 'px'
    if (effect === 'burst' || effect === 'sparkles') {
      const count = effect === 'burst' ? 8 : 5
      for (let index = 0; index < count; index++) {
        const fragment = document.createElement('i')
        const angle = (index * 2 * Math.PI) / count + (event.timeStamp % 15)
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
    if (this.childElementCount >= 20) this.firstElementChild.remove()
    this.append(particle)
  }
}

customElements.define('rvnce-pointer', ProfilePointer)
