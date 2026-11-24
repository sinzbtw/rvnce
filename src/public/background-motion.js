// @ts-check
;(() => {
  class BackgroundMotion extends HTMLElement {
    /** @type {(() => void) | undefined} */
    cleanup

    connectedCallback() {
      queueMicrotask(() => {
        if (!this.isConnected || this.cleanup) return
        const button = this.querySelector('button')
        const image = this.querySelector('img.background-moving')
        const posterSrc = image?.getAttribute('src')
        const video = this.querySelector('video')
        const media = video ?? image
        const url = this.dataset.url
        if (!button || !media || !url) return
        const preference = matchMedia('(prefers-reduced-motion: reduce)')
        let requested = false
        let failed = false
        let generation = 0

        const update = () => {
          button.textContent = requested ? 'Stop background' : 'Play background'
          button.hidden = failed
        }
        const stop = () => {
          generation++
          requested = false
          this.removeAttribute('data-playing')
          if (video) video.pause()
          else if (image && posterSrc) image.setAttribute('src', posterSrc)
          update()
        }
        const loaded = () => {
          if (requested) this.setAttribute('data-playing', '')
        }
        const error = () => {
          failed = true
          stop()
        }
        const play = async () => {
          if (failed) return
          const current = ++generation
          requested = true
          update()
          if (video) {
            video.muted = true
            if (!video.getAttribute('src')) video.src = url
            try {
              await video.play()
              if (current === generation && requested) loaded()
            } catch {
              if (current === generation && !failed) stop()
            }
          } else if (image instanceof HTMLImageElement) {
            image.src = url
            if (image.complete && image.naturalWidth) loaded()
          }
        }
        const click = () => {
          if (requested) stop()
          else void play()
        }
        const preferenceChanged = () => {
          if (preference.matches) stop()
        }
        media.addEventListener('error', error)
        image?.addEventListener('load', loaded)
        button.addEventListener('click', click)
        preference.addEventListener('change', preferenceChanged)
        update()
        if (!preference.matches) void play()

        this.cleanup = () => {
          stop()
          media.removeEventListener('error', error)
          image?.removeEventListener('load', loaded)
          button.removeEventListener('click', click)
          preference.removeEventListener('change', preferenceChanged)
          media.removeAttribute('src')
          video?.load()
        }
      })
    }

    disconnectedCallback() {
      this.cleanup?.()
      this.cleanup = undefined
    }
  }

  if (!customElements.get('rvnce-motion'))
    customElements.define('rvnce-motion', BackgroundMotion)
})()
