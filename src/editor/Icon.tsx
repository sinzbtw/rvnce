const icons = {
  upload: 'M12 16V4m-4 4 4-4 4 4M5 15v4h14v-4',
  download: 'M12 4v12m-4-4 4 4 4-4M5 16v3h14v-3',
  file: 'M7 4h7l4 4v12H7zM14 4v5h4M10 13h5m-5 3h5',
  monitor: 'M3 5h18v12H3zM8 21h8m-4-4v4',
  phone:
    'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 15h2',
  external: 'M13 5h6v6m0-6-8 8m7 0v6H5V6h6',
  plus: 'M12 5v14M5 12h14',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  remove: 'M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5m-7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 15a8.5 8.5 0 0 1-11-11 8.5 8.5 0 1 0 11 11z',
} as const

export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      aria-hidden="true"
      class="icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d={icons[name]}
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
