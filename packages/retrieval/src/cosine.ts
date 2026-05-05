export function dotProduct(a: number[], b: number[]): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) sum += (a[i] ?? 0) * (b[i] ?? 0)
  return sum
}

export function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0))
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a)
  const magB = magnitude(b)
  if (magA === 0 || magB === 0) return 0
  return dotProduct(a, b) / (magA * magB)
}
