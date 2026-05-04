import type { InjectionResolution } from '../types/adapter'

export function selectResolution(windowWidth: number): InjectionResolution {
  if (windowWidth >= 1200) return 'full'
  if (windowWidth >= 800) return 'compact'
  return 'minimal'
}
