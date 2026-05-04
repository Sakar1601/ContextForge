import { z } from 'zod'
import { PlatformSchema } from './platform'

export const ProvenanceMapSchema = z.object({
  id: z.string(),
  turnId: z.string(),
  capsuleIds: z.array(z.string()),
  platform: PlatformSchema,
  injectedAt: z.string().datetime(),
})
export type ProvenanceMap = z.infer<typeof ProvenanceMapSchema>
