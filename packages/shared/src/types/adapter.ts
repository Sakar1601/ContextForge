import { z } from 'zod'
import type { CapsuleManifest } from './capsule'
import type { Platform } from './platform'

export const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  index: z.number().int().nonnegative(),
})
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>

export const InjectionResolutionSchema = z.enum(['full', 'compact', 'minimal'])
export type InjectionResolution = z.infer<typeof InjectionResolutionSchema>

export const AdapterHealthSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('healthy') }),
  z.object({ status: z.literal('unhealthy'), reason: z.string() }),
])
export type AdapterHealth = z.infer<typeof AdapterHealthSchema>

export interface SiteAdapter {
  readonly platform: Platform
  health(): AdapterHealth
  extractConversation(): ConversationTurn[]
  getInjectionTarget(): Element | null
  injectContext(capsule: CapsuleManifest, resolution: InjectionResolution): Element
  observeChanges(callback: (turns: ConversationTurn[]) => void): () => void
}
