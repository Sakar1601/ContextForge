import { z } from 'zod'

export const ExtractionResultSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  decisions: z.array(z.string()),
  openQuestions: z.array(z.string()),
})
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>
