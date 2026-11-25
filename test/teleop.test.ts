import { describe, expect, it } from 'vitest'
import { driveKeyFor, SQUARE_PATTERN, twistFor, type DriveKey } from '~/utils/teleop'

describe('driveKeyFor', () => {
  it('maps arrows and WASD in either case, and nothing else', () => {
    expect(driveKeyFor('ArrowUp')).toBe('forward')
    expect(driveKeyFor('W')).toBe('forward')
    expect(driveKeyFor('d')).toBe('right')
    expect(driveKeyFor('q')).toBeNull()
  })
})

describe('twistFor', () => {
  const held = (...keys: DriveKey[]) => new Set(keys)

  it('stands still with nothing held, and when opposite keys cancel', () => {
    expect(twistFor(held(), 1)).toEqual({ linear_speed: 0, angular_speed: 0 })
    expect(twistFor(held('forward', 'back', 'left', 'right'), 1)).toEqual({ linear_speed: 0, angular_speed: 0 })
  })

  it('scales within the publisher limits and clamps the scale', () => {
    expect(twistFor(held('forward', 'left'), 0.5)).toEqual({ linear_speed: 0.25, angular_speed: 1 })
    expect(twistFor(held('back', 'right'), 3)).toEqual({ linear_speed: -0.5, angular_speed: -2 })
  })
})

describe('SQUARE_PATTERN', () => {
  it('accepts A1 to P16 only', () => {
    expect(['A1', 'C7', 'P16'].every(s => SQUARE_PATTERN.test(s))).toBe(true)
    expect(['Q1', 'A0', 'A17', 'a1'].some(s => SQUARE_PATTERN.test(s))).toBe(false)
  })
})
