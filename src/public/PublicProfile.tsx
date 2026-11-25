import { h } from 'preact'
import {
  officialEditor,
  profileLanguage,
  type ProfileDocument,
} from '../profile/document'
import { imageVariable, profileVariables } from './appearance-css'

export interface ProfileAssets {
  avatarUrl: string | null
  backgroundUrl?: string | undefined
  posterUrl?: string | undefined
  cursorUrl?: string | undefined
}

interface PreviewLabels {
  locale: string
  name: string
  links: string
  credit: string
  playBackground: string
  stopBackground: string
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase()
}

export function PublicProfile({
  doc,
  assets,
  preview = false,
  previewLabels,
}: {
  doc: ProfileDocument
  assets: ProfileAssets
  preview?: boolean
  previewLabels?: PreviewLabels
}) {
  const { profile, appearance, blocks } = doc
  const { avatarUrl, backgroundUrl, posterUrl, cursorUrl } = assets
  const {
    cursor,
    trail,
    overlay,
    click,
    name: nameEffect,
    sparkles,
  } = appearance.effects
  const media = appearance.background.media
  const motion = media && 'poster' in media && backgroundUrl && posterUrl
  const enteredName = profile.name.trim()
  const name = enteredName || previewLabels?.name || 'Your name'
  const language = profileLanguage(profile.language)
  const previewLocale = previewLabels?.locale

  return (
    <article
      class="public-profile"
      data-variant={appearance.variant}
      data-preset={appearance.preset}
      data-avatar-position={appearance.avatar.position}
      data-avatar-shape={appearance.avatar.shape}
      data-link-style={appearance.links.style}
      data-hover={appearance.links.hover}
      data-align={appearance.typography.align}
      data-entrance={String(appearance.entrance)}
      data-cursor={cursor.preset}
      style={
        preview
          ? {
              ...profileVariables(appearance),
              ...(cursorUrl
                ? { '--cursor-image': imageVariable(cursorUrl) }
                : {}),
            }
          : undefined
      }
      lang={language}
      dir="auto"
    >
      {motion &&
        h(
          'rvnce-motion',
          {
            key: backgroundUrl,
            'data-url': backgroundUrl,
            'data-media': media.type,
          },
          <div class="profile-backdrop" aria-hidden="true">
            <img class="background-poster" src={posterUrl} alt="" />
            {media.type === 'video/mp4' ? (
              <video
                class="background-moving"
                muted
                playsInline
                loop
                preload="none"
              />
            ) : (
              <img class="background-moving" src={posterUrl} alt="" />
            )}
          </div>,
          <button
            class="background-control"
            type="button"
            hidden
            lang={previewLocale ?? 'en'}
            dir="ltr"
            data-play-label={previewLabels?.playBackground}
            data-stop-label={previewLabels?.stopBackground}
          >
            {previewLabels?.playBackground ?? 'Play background'}
          </button>,
        )}
      {!motion && backgroundUrl && (
        <div class="profile-backdrop" aria-hidden="true">
          <img src={backgroundUrl} alt="" />
        </div>
      )}
      {overlay.preset !== 'none' && (
        <div
          class="profile-overlay"
          data-overlay={overlay.preset}
          aria-hidden="true"
        >
          {overlay.preset !== 'grain' &&
            Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
      )}
      {(click.preset !== 'none' || trail !== 'none') &&
        h('rvnce-pointer', {
          class: 'profile-pointer',
          'aria-hidden': 'true',
          'data-click': click.preset,
          'data-trail': trail,
        })}
      <div class="profile-card">
        <header class="profile-intro">
          <h1
            class="profile-name"
            lang={enteredName ? undefined : previewLocale}
          >
            <span class="profile-name-inline">
              <span
                class="profile-name-text"
                data-name-effect={
                  nameEffect.enabled ? nameEffect.preset : undefined
                }
              >
                {name}
              </span>
              {sparkles.enabled && (
                <span class="profile-name-sparkles" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </span>
          </h1>
          <div class="profile-portrait">
            {avatarUrl ? (
              <img src={avatarUrl} width="384" height="384" alt="" />
            ) : (
              <span aria-hidden="true">{initials(name)}</span>
            )}
          </div>
          {profile.bio.trim() && (
            <p class="profile-bio">{profile.bio.trim()}</p>
          )}
        </header>
        {blocks.length > 0 && (
          <ul
            class="profile-links"
            aria-label={previewLabels?.links ?? 'Profile links'}
            lang={previewLocale}
            role="list"
          >
            {blocks.map((block) => {
              const content = (
                <>
                  <span>{block.label.trim()}</span>
                  <svg
                    aria-hidden="true"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 18 18 6M7 6h11v11"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </>
              )
              return (
                <li key={block.id} lang={previewLocale ? language : undefined}>
                  {preview ? (
                    <span class="profile-link">{content}</span>
                  ) : (
                    <a
                      class="profile-link"
                      href={block.url.trim()}
                      rel="noreferrer"
                    >
                      {content}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {doc.branding.showMadeWithRvnce && (
        <footer class="profile-footer" lang={previewLocale ?? 'en'} dir="ltr">
          {preview ? (
            <span>{previewLabels?.credit ?? 'Made with Rvnce'}</span>
          ) : (
            <a href={officialEditor} rel="noreferrer">
              Made with Rvnce
            </a>
          )}
        </footer>
      )}
    </article>
  )
}
