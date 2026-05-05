// Offscreen document — hosts the transformers.js embedding pipeline.
// Only this context is NOT subject to MV3 service worker lifetime limits.
// Communication: SW sends { target: 'offscreen', type: 'EMBED_REQUEST', texts }
// and awaits the response via sendResponse.

import { pipeline, env } from '@xenova/transformers'

// Use browser cache; do not attempt server-side Node paths
env.useBrowserCache = true
env.allowLocalModels = false

type FeatureExtractionPipeline = Awaited<ReturnType<typeof pipeline<'feature-extraction'>>>
let extractor: FeatureExtractionPipeline | null = null

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    })
  }
  return extractor
}

chrome.runtime.onMessage.addListener(
  (
    message: { target?: string; type?: string; texts?: string[] },
    _sender,
    sendResponse: (r: unknown) => void,
  ) => {
    if (message.target !== 'offscreen') return false
    if (message.type !== 'EMBED_REQUEST') {
      sendResponse({ error: `Unknown offscreen message: ${message.type}` })
      return true
    }

    const texts = message.texts ?? []
    getExtractor()
      .then(async (model) => {
        const embeddings: number[][] = []
        for (const text of texts) {
          // mean pooling of the last hidden state → 384-dim vector
          const output = await model(text, { pooling: 'mean', normalize: true })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transformers.js tensor has no public type
          embeddings.push(Array.from((output as any).data as Float32Array))
        }
        sendResponse({ type: 'EMBED_RESPONSE', embeddings })
      })
      .catch((err: unknown) => sendResponse({ error: String(err) }))

    return true // keep channel open for async response
  },
)
