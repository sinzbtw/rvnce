export function accentInk(color: string): '#000000' | '#ffffff' {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(color.slice(start, start + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  const [red = 0, green = 0, blue = 0] = channels
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance >= 0.179 ? '#000000' : '#ffffff'
}
