/** The turtle's `drive` publisher limits, from its input schema. */
export const MAX_LINEAR = 0.5
export const MAX_ANGULAR = 2

export type DriveKey = 'forward' | 'back' | 'left' | 'right'

const KEYS: Record<string, DriveKey> = {
  ArrowUp: 'forward',
  w: 'forward',
  ArrowDown: 'back',
  s: 'back',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right'
}

export function driveKeyFor(key: string): DriveKey | null {
  return KEYS[key.length === 1 ? key.toLowerCase() : key] ?? null
}

/** The `drive` message for the keys held, at `scale` (0 to 1) of full speed. Opposite keys cancel out. */
export function twistFor(held: ReadonlySet<DriveKey>, scale: number) {
  const s = Math.min(Math.max(scale, 0), 1)
  const linear = Number(held.has('forward')) - Number(held.has('back'))
  const angular = Number(held.has('left')) - Number(held.has('right'))
  return { linear_speed: linear * MAX_LINEAR * s, angular_speed: angular * MAX_ANGULAR * s }
}

export const SQUARE_PATTERN = /^[A-P]([1-9]|1[0-6])$/
