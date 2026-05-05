import dagre from 'dagre'
import type { Node, Edge } from 'reactflow'
import type { CapsuleManifest } from '@contextforge/shared'

const NODE_W = 220
const NODE_H = 64

export function buildLayout(manifests: CapsuleManifest[]): {
  nodes: Node<CapsuleManifest>[]
  edges: Edge[]
} {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const m of manifests) {
    g.setNode(m.id, { width: NODE_W, height: NODE_H })
  }

  const edges: Edge[] = []
  for (const m of manifests) {
    for (const parentId of m.parentIds) {
      g.setEdge(parentId, m.id)
      edges.push({
        id: `${parentId}-${m.id}`,
        source: parentId,
        target: m.id,
        type: 'smoothstep',
      })
    }
  }

  dagre.layout(g)

  const nodes: Node<CapsuleManifest>[] = manifests.map((m) => {
    const pos = g.node(m.id)
    return {
      id: m.id,
      type: 'capsule',
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: m,
    }
  })

  return { nodes, edges }
}
