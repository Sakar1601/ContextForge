// One-time script: generates extension icons at 16, 48, 128 px from an inline SVG.
// Run: node scripts/generate-icons.mjs
import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../packages/extension/src/icons')
mkdirSync(OUT, { recursive: true })

function makeSvg(size) {
  const r = Math.round(size * 0.16)    // corner radius
  const fs = Math.round(size * 0.38)   // font size
  const cy = Math.round(size * 0.645)  // text baseline

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <text
    x="${size / 2}" y="${cy}"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700"
    font-size="${fs}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="-1"
  >CF</text>
</svg>`
}

for (const size of [16, 48, 128]) {
  const svg = makeSvg(size)
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  const out = resolve(OUT, `icon${size}.png`)
  writeFileSync(out, png)
  console.log(`✓ ${out} (${png.length} bytes)`)
}
