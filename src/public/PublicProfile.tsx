import { type ProfileDocument } from '../profile/document'

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
}: {
  doc: ProfileDocument
  avatarUrl: string | null
}) {
  const { profile, appearance, blocks } = doc
  const name = profile.name.trim() || 'Your name'

  return (
    <article class="public-profile" data-variant={appearance.variant}>
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
          {blocks.map((block) => (
            <li key={block.id}>
              <a href={block.url.trim()} rel="noreferrer">
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
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
