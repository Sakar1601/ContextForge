const K1 = 1.5
const B = 0.75

export type BM25Index = {
  idf: Map<string, number>
  tfs: Map<string, Map<string, number>>  // docId → (term → tf)
  avgdl: number
  dls: Map<string, number>              // docId → doc length
  N: number
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\w+/g) ?? []
}

export function buildBM25(docs: { id: string; text: string }[]): BM25Index {
  const N = docs.length
  const tfs = new Map<string, Map<string, number>>()
  const df = new Map<string, number>()
  const dls = new Map<string, number>()
  let totalLen = 0

  for (const { id, text } of docs) {
    const tokens = tokenize(text)
    dls.set(id, tokens.length)
    totalLen += tokens.length
    const tf = new Map<string, number>()
    for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1)
    tfs.set(id, tf)
    for (const tok of tf.keys()) df.set(tok, (df.get(tok) ?? 0) + 1)
  }

  const idf = new Map<string, number>()
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1))
  }

  return { idf, tfs, avgdl: N > 0 ? totalLen / N : 0, dls, N }
}

export function scoreBM25(index: BM25Index, query: string): Map<string, number> {
  const { idf, tfs, avgdl, dls } = index
  const queryTerms = tokenize(query)
  const scores = new Map<string, number>()

  for (const [docId, tf] of tfs) {
    const dl = dls.get(docId) ?? 0
    let score = 0
    for (const term of queryTerms) {
      const termIdf = idf.get(term) ?? 0
      const termTf = tf.get(term) ?? 0
      score +=
        termIdf *
        ((termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * (dl / (avgdl || 1)))))
    }
    if (score > 0) scores.set(docId, score)
  }

  return scores
}
