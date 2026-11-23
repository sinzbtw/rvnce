import { profileLanguage, type ProfileDocument } from '../profile/document'

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
  avatarUrl,
  preview = false,
}: {
  doc: ProfileDocument
  avatarUrl: string | null
  preview?: boolean
}) {
  const { profile, appearance, blocks } = doc
  const name = profile.name.trim() || 'Your name'

  return (
    <article
      class="public-profile"
      data-variant={appearance.variant}
      lang={profileLanguage(profile.language)}
      dir="auto"
    >
      <header class="profile-intro">
        <h1 class="profile-name">{name}</h1>
        <div class="profile-portrait">
          {avatarUrl ? (
            <img src={avatarUrl} width="384" height="384" alt="" />
          ) : (
            <span aria-hidden="true">{initials(name)}</span>
          )}
        </div>
        {profile.bio.trim() && <p class="profile-bio">{profile.bio.trim()}</p>}
      </header>
      {blocks.length > 0 && (
        <ul class="profile-links" aria-label="Profile links" role="list">
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
              <li key={block.id}>
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
    </article>
  )
}
