import { z } from 'zod'
import { CapsuleManifestSchema } from './capsule'
import { AdapterHealthSchema, ConversationTurnSchema } from './adapter'

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CAPTURE_REQUEST'), tabId: z.number() }),
  z.object({ type: z.literal('CAPTURE_RESPONSE'), capsuleId: z.string() }),
  z.object({
    type: z.literal('INJECT_REQUEST'),
    capsuleId: z.string(),
    tabId: z.number(),
  }),
  z.object({
    type: z.literal('INJECT_RESPONSE'),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  z.object({ type: z.literal('ADAPTER_HEALTH_REQUEST'), tabId: z.number() }),
  z.object({
    type: z.literal('ADAPTER_HEALTH_RESPONSE'),
    status: z.enum(['healthy', 'unhealthy']),
    reason: z.string().optional(),
  }),
  z.object({ type: z.literal('EMBED_REQUEST'), texts: z.array(z.string()) }),
  z.object({ type: z.literal('EMBED_RESPONSE'), embeddings: z.array(z.array(z.number())) }),
  z.object({
    type: z.literal('SEARCH_REQUEST'),
    query: z.string(),
    limit: z.number(),
  }),
  z.object({ type: z.literal('SEARCH_RESPONSE'), capsuleIds: z.array(z.string()) }),
  // Phase 3: capsule listing and turn extraction
  z.object({ type: z.literal('LIST_CAPSULES_REQUEST'), limit: z.number() }),
  z.object({
    type: z.literal('LIST_CAPSULES_RESPONSE'),
    manifests: z.array(CapsuleManifestSchema),
  }),
  z.object({ type: z.literal('EXTRACT_TURNS_REQUEST') }),
  z.object({
    type: z.literal('EXTRACT_TURNS_RESPONSE'),
    turns: z.array(ConversationTurnSchema),
    health: AdapterHealthSchema,
  }),
])
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>
