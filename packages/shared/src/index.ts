export { PLATFORMS, PlatformSchema } from './types/platform'
export type { Platform } from './types/platform'

export { ChunkSchema, CapsuleManifestSchema, CapsuleBodySchema, CapsuleSchema } from './types/capsule'
export type { Chunk, CapsuleManifest, CapsuleBody, Capsule } from './types/capsule'

export { ProvenanceMapSchema } from './types/provenance'
export type { ProvenanceMap } from './types/provenance'

export {
  ConversationTurnSchema,
  InjectionResolutionSchema,
  AdapterHealthSchema,
} from './types/adapter'
export type {
  ConversationTurn,
  InjectionResolution,
  AdapterHealth,
  SiteAdapter,
} from './types/adapter'

export { ExtensionMessageSchema } from './types/messaging'
export type { ExtensionMessage } from './types/messaging'

export { computeCapsuleId } from './dag/hash'

export { selectResolution } from './dag/resolution'

export { commit, branchFrom, merge, diff, cherryPickFields } from './dag/operations'
export type {
  Branch,
  FieldChange,
  DiffResult,
  FieldConflict,
  ConflictMap,
  MergeResult,
} from './dag/operations'
