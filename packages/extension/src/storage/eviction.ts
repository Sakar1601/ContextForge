import type { BodyRepository } from './repositories/body-repository'
import type { CapsuleRepository } from './repositories/capsule-repository'

type StorageEstimateFn = () => Promise<{ usage?: number; quota?: number }>

const defaultEstimate: StorageEstimateFn = () => navigator.storage.estimate()

export async function maybeEvict(
  capsuleRepo: CapsuleRepository,
  bodyRepo: BodyRepository,
  options?: {
    thresholdRatio?: number
    batchSize?: number
    estimateFn?: StorageEstimateFn
  },
): Promise<number> {
  const thresholdRatio = options?.thresholdRatio ?? 0.8
  const batchSize = options?.batchSize ?? 10
  const estimateFn = options?.estimateFn ?? defaultEstimate

  const { usage = 0, quota = Infinity } = await estimateFn()
  if (quota === 0 || usage / quota < thresholdRatio) return 0

  const oldestIds = await capsuleRepo.listOldestIds(batchSize * 3)
  return bodyRepo.evictFullText(batchSize, oldestIds)
}
