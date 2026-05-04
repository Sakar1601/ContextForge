import { useEffect, useState } from 'react'
import type { AdapterHealth } from '@contextforge/shared'

export function useAdapterHealth(tabId: number | null): AdapterHealth | null {
  const [health, setHealth] = useState<AdapterHealth | null>(null)

  useEffect(() => {
    if (tabId === null) return

    chrome.runtime
      .sendMessage({ type: 'ADAPTER_HEALTH_REQUEST', tabId })
      .then((res: { status: string; reason?: string }) => {
        if (res.status === 'healthy') {
          setHealth({ status: 'healthy' })
        } else {
          setHealth({ status: 'unhealthy', reason: res.reason ?? 'Unknown error' })
        }
      })
      .catch(() => setHealth({ status: 'unhealthy', reason: 'Could not reach content script' }))
  }, [tabId])

  return health
}
