import { h } from 'preact'
import type { TabTitleMotion } from '../profile/effects'
import { Icon } from './Icon'

export function PreviewTab({
  title,
  favicon,
  motion,
}: {
  title: string
  favicon: string | null
  motion?: TabTitleMotion | undefined
}) {
  return (
    <span class="preview-tab" aria-hidden="true">
      {favicon ? (
        <img src={favicon} alt="" width="16" height="16" />
      ) : (
        <Icon name="file" />
      )}
      {!motion || motion.preset === 'none' ? (
        <bdi>{title}</bdi>
      ) : (
        h(
          'rvnce-tab-title',
          {
            key: JSON.stringify([title, motion.preset, motion.speed]),
            'data-motion': motion.preset,
            'data-speed': motion.speed,
          },
          <bdi>{title}</bdi>,
        )
      )}
    </span>
  )
}
