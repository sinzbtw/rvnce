import { ArrowUpRight } from 'lucide-preact'
import { h } from 'preact'
import {
  officialEditor,
  profileLanguage,
  type ProfileDocument,
} from '../profile/document'
import { iconForUrl } from '../profile/effects'
import { imageVariable, profileVariables } from './appearance-css'
import { SocialIcon } from './SocialIcon'

const rainColumns = [
  'ヌメ01ネ',
  '010タロ1',
  'シ101サ',
  'ヒ0コ1ミ',
  'ト01ノ0',
  'リ1ナ0イ',
]

export interface ProfileAssets {
  avatarUrl: string | null
  backgroundUrl?: string | undefined
  posterUrl?: string | undefined
  cursorUrl?: string | undefined
  iconUrls?: Record<string, string>
}

interface PreviewLabels {
  locale: string
  name: string
  links: string
  iconLinks: string
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
  const { avatarUrl, backgroundUrl, posterUrl, cursorUrl, iconUrls } = assets
  const {
    cursor,
    trail,
    overlay,
    click,
    name: nameEffect,
    sparkles,
  } = appearance.effects
  const buttons = blocks.filter((block) => block.type === 'link')
  const icons = blocks.filter((block) => block.type === 'icon')
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
          {overlay.preset === 'matrix' ? (
            <div class="matrix-columns">
              {Array.from({ length: 18 }, (_, index) => (
                <div
                  class="matrix-stream"
                  key={index}
                  hidden={
                    (index * 7) % 18 >= Math.ceil(overlay.intensity * 0.18)
                  }
                >
                  {Array.from(
                    rainColumns[index % rainColumns.length]!,
                    (glyph, position) => (
                      <span key={position}>{glyph}</span>
                    ),
                  )}
                  <b>{index % 2 === 0 ? '1' : '0'}</b>
                </div>
              ))}
            </div>
          ) : overlay.preset === 'glitch' ? (
            <>
              <span />
              <span />
              <span />
            </>
          ) : (
            overlay.preset !== 'grain' &&
            Array.from({ length: 12 }, (_, index) => <i key={index} />)
          )}
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
        {buttons.length > 0 && (
          <ul
            class="profile-links"
            aria-label={previewLabels?.links ?? 'Profile links'}
            lang={previewLocale}
            role="list"
          >
            {buttons.map((block) => {
              const content = (
                <>
                  <span>{block.label.trim()}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    size={19}
                    strokeWidth={1.8}
                  />
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
        {icons.length > 0 && (
          <ul
            class="profile-social"
            aria-label={previewLabels?.iconLinks ?? 'Social links'}
            lang={previewLocale}
            role="list"
          >
            {icons.map((link, index) => {
              const url = Object.hasOwn(iconUrls ?? {}, link.id)
                ? iconUrls?.[link.id]
                : undefined
              const custom = link.icon === 'custom' && url
              const icon =
                link.icon === 'auto'
                  ? iconForUrl(link.url)
                  : link.icon === 'custom'
                    ? 'website'
                    : link.icon
              const content = (
                <>
                  {custom ? (
                    link.tint ? (
                      <span
                        class="profile-social-tint"
                        aria-hidden="true"
                        style={
                          preview
                            ? { '--icon-image': imageVariable(custom) }
                            : undefined
                        }
                      />
                    ) : (
                      <img width="22" height="22" src={custom} alt="" />
                    )
                  ) : (
                    <SocialIcon icon={icon} />
                  )}
                  <span class="profile-link-label">{link.label.trim()}</span>
                </>
              )
              return (
                <li
                  key={link.id}
                  data-icon-slot={index}
                  lang={previewLocale ? language : undefined}
                >
                  {preview ? (
                    <span class="profile-social-link" title={link.label.trim()}>
                      {content}
                    </span>
                  ) : (
                    <a
                      class="profile-social-link"
                      href={link.url.trim()}
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
