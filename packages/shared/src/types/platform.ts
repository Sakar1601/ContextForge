import { z } from 'zod'

export const PLATFORMS = [
  'claude',
  'chatgpt',
  'gemini',
  'perplexity',
  'deepseek',
  'gmail',
] as const

export const PlatformSchema = z.enum(PLATFORMS)
export type Platform = z.infer<typeof PlatformSchema>
