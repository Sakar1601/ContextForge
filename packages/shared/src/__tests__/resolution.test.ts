import { describe, expect, it } from 'vitest'
import { selectResolution } from '../dag/resolution'

describe('selectResolution', () => {
  it('returns "full" at exactly 1200px', () => {
    expect(selectResolution(1200)).toBe('full')
  })

  it('returns "full" above 1200px', () => {
    expect(selectResolution(1920)).toBe('full')
    expect(selectResolution(2560)).toBe('full')
  })

  it('returns "compact" between 800px and 1199px inclusive', () => {
    expect(selectResolution(800)).toBe('compact')
    expect(selectResolution(1000)).toBe('compact')
    expect(selectResolution(1199)).toBe('compact')
  })

  it('returns "minimal" below 800px', () => {
    expect(selectResolution(799)).toBe('minimal')
    expect(selectResolution(375)).toBe('minimal')
    expect(selectResolution(0)).toBe('minimal')
  })
})
