import { z } from 'zod'
import { CapsuleManifestSchema } from './capsule'
import { AdapterHealthSchema, ConversationTurnSchema, InjectionResolutionSchema } from './adapter'

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CAPTURE_REQUEST'), tabId: z.number() }),
  z.object({ type: z.literal('CAPTURE_RESPONSE'), capsuleId: z.string() }),
  z.object({
    type: z.literal('INJECT_REQUEST'),
    capsuleId: z.string(),
    tabId: z.number().optional(),
    windowWidth: z.number().optional(),
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
  // Phase 4: injection command (SW → content script)
  z.object({
    type: z.literal('INJECT_COMMAND'),
    manifest: CapsuleManifestSchema,
    resolution: InjectionResolutionSchema,
  }),
  // Phase 5: version graph, rollback, branches
  z.object({ type: z.literal('GET_CAPSULE_GRAPH_REQUEST'), capsuleId: z.string() }),
  z.object({
    type: z.literal('GET_CAPSULE_GRAPH_RESPONSE'),
    manifests: z.array(CapsuleManifestSchema),
  }),
  z.object({ type: z.literal('ROLLBACK_REQUEST'), capsuleId: z.string() }),
  z.object({ type: z.literal('ROLLBACK_RESPONSE'), success: z.boolean() }),
  z.object({
    type: z.literal('BRANCH_CREATE_REQUEST'),
    name: z.string(),
    tipId: z.string(),
  }),
  z.object({
    type: z.literal('BRANCH_CREATE_RESPONSE'),
    branch: z.object({ name: z.string(), tipId: z.string() }),
  }),
  z.object({ type: z.literal('BRANCH_LIST_REQUEST') }),
  z.object({
    type: z.literal('BRANCH_LIST_RESPONSE'),
    branches: z.array(z.object({ name: z.string(), tipId: z.string() })),
  }),
])
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>
