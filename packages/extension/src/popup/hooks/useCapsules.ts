import { useCallback, useEffect, useState } from 'react'
import type { CapsuleManifest } from '@contextforge/shared'

export function useCapsules(limit = 20) {
  const [capsules, setCapsules] = useState<CapsuleManifest[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    chrome.runtime
      .sendMessage({ type: 'LIST_CAPSULES_REQUEST', limit })
      .then((res: { manifests: CapsuleManifest[] }) => {
        setCapsules(res.manifests)
      })
      .catch(() => setCapsules([]))
      .finally(() => setLoading(false))
  }, [limit])

  useEffect(() => { refresh() }, [refresh])

  return { capsules, loading, refresh }
}
