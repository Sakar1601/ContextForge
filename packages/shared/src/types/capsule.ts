import { z } from 'zod'
import { PlatformSchema } from './platform'

export const ChunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  embedding: z.array(z.number()).optional(),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().nonnegative(),
})
export type Chunk = z.infer<typeof ChunkSchema>

export const CapsuleManifestSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  decisions: z.array(z.string()),
  openQuestions: z.array(z.string()),
  platform: PlatformSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  turnCount: z.number().int().nonnegative(),
  tokenEstimate: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  parentIds: z.array(z.string()),
  compressed: z.boolean(),
  liftScore: z.number().min(-1).max(1).optional(),
})
export type CapsuleManifest = z.infer<typeof CapsuleManifestSchema>

export const CapsuleBodySchema = z.object({
  capsuleId: z.string(),
  full: z.string().optional(),
  chunks: z.array(ChunkSchema),
})
export type CapsuleBody = z.infer<typeof CapsuleBodySchema>

export const CapsuleSchema = z.object({
  manifest: CapsuleManifestSchema,
  body: CapsuleBodySchema,
})
export type Capsule = z.infer<typeof CapsuleSchema>
