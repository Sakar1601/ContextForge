import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useEdgesState, useNodesState } from 'reactflow'
import type { Node } from 'reactflow'
import 'reactflow/dist/style.css'
import { commit, merge } from '@contextforge/shared'
import type { CapsuleManifest, MergeResult } from '@contextforge/shared'
import { buildLayout } from './layout'
import { CapsuleNode } from './components/CapsuleNode'
import { DiffPanel } from './components/DiffPanel'
import { MergeConflictModal } from './components/MergeConflictModal'

const nodeTypes = { capsule: CapsuleNode }

export default function GraphApp() {
  const params = new URLSearchParams(location.search)
  // Validate that the id is a 64-char hex string (SHA-256 capsule id) before using it.
  const rawId = params.get('id') ?? ''
  const rootId = /^[0-9a-f]{64}$/.test(rawId) ? rawId : ''

  const [manifests, setManifests] = useState<CapsuleManifest[]>([])
  const [activeCapsuleId, setActiveCapsuleId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null)
  const [pendingMerge, setPendingMerge] = useState<{ result: Extract<MergeResult, { type: 'conflict' }>; leftId: string; rightId: string } | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // ── fetch graph ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rootId) return
    chrome.runtime
      .sendMessage({ type: 'GET_CAPSULE_GRAPH_REQUEST', capsuleId: rootId })
      .then((res: { manifests: CapsuleManifest[] }) => {
        setManifests(res.manifests)
        // load active capsule id from storage
        void chrome.storage.local.get(`active_${rootId}`).then((stored) => {
          setActiveCapsuleId((stored[`active_${rootId}`] as string | undefined) ?? null)
        })
      })
  }, [rootId])

  // ── rebuild layout whenever manifests change ──────────────────────────────
  useEffect(() => {
    if (manifests.length === 0) return
    const { nodes: n, edges: e } = buildLayout(manifests)
    const enriched = n.map((node) => ({
      ...node,
      data: { ...node.data, isActive: node.id === activeCapsuleId },
    }))
    setNodes(enriched)
    setEdges(e)
  }, [manifests, activeCapsuleId, setNodes, setEdges])

  const selectedManifest = useMemo(
    () => manifests.find((m) => m.id === selectedId) ?? null,
    [manifests, selectedId],
  )

  const parentOfSelected = useMemo(() => {
    if (!selectedManifest || selectedManifest.parentIds.length === 0) return null
    return manifests.find((m) => m.id === selectedManifest.parentIds[0]) ?? null
  }, [selectedManifest, manifests])

  // ── node selection ────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<CapsuleManifest>) => {
    setSelectedId(node.id)
    setMergeTargetId(null)
  }, [])

  // ── actions ───────────────────────────────────────────────────────────────
  async function handleRollback() {
    if (!selectedId || !rootId) return
    await chrome.runtime.sendMessage({ type: 'ROLLBACK_REQUEST', capsuleId: selectedId })
    setActiveCapsuleId(selectedId)
    setStatusMsg(`Rolled back to: ${selectedManifest?.title ?? selectedId.slice(0, 8)}`)
    setTimeout(() => setStatusMsg(null), 3000)
  }

  async function handleBranch() {
    if (!selectedId) return
    const name = window.prompt('Branch name:')
    if (!name?.trim()) return
    await chrome.runtime.sendMessage({
      type: 'BRANCH_CREATE_REQUEST',
      name: name.trim(),
      tipId: selectedId,
    })
    setStatusMsg(`Branch "${name.trim()}" created`)
    setTimeout(() => setStatusMsg(null), 3000)
  }

  async function handleMerge() {
    if (!selectedId || !mergeTargetId) return
    const leftManifest = manifests.find((m) => m.id === selectedId)
    const rightManifest = manifests.find((m) => m.id === mergeTargetId)
    if (!leftManifest || !rightManifest) return

    // Find LCA (common ancestor) — for simplicity use the root
    const baseManifest = manifests.find((m) => m.parentIds.length === 0) ?? leftManifest

    const result = merge(baseManifest, leftManifest, rightManifest)

    if (result.type === 'clean') {
      const now = new Date().toISOString()
      const merged = await commit({
        ...result.manifest,
        createdAt: leftManifest.createdAt,
        updatedAt: now,
        parentIds: [selectedId, mergeTargetId],
        compressed: leftManifest.compressed,
      })
      // Persist via SW capture path — for now just refresh
      setStatusMsg(`Merged into: ${merged.title}`)
      setTimeout(() => setStatusMsg(null), 3000)
    } else {
      setPendingMerge({ result, leftId: selectedId, rightId: mergeTargetId })
    }
    setMergeTargetId(null)
  }

  async function handleConflictResolve(resolved: Partial<CapsuleManifest>, parentIds: string[]) {
    const leftManifest = manifests.find((m) => m.id === parentIds[0])
    if (!leftManifest) return
    const now = new Date().toISOString()
    const merged = await commit({
      ...(resolved as Omit<CapsuleManifest, 'id'>),
      createdAt: leftManifest.createdAt,
      updatedAt: now,
      parentIds,
      compressed: leftManifest.compressed,
    })
    setPendingMerge(null)
    setStatusMsg(`Conflict resolved — merged as: ${merged.title}`)
    setTimeout(() => setStatusMsg(null), 3000)
  }

  // ── cherry-pick ───────────────────────────────────────────────────────────
  function handleCherryPick() {
    if (!selectedManifest) return
    const fields = window.prompt(
      'Fields to cherry-pick (comma-separated):\ngoals, constraints, decisions, openQuestions, tags',
    )
    if (!fields?.trim()) return
    const keys = fields.split(',').map((f) => f.trim()) as Array<keyof CapsuleManifest>
    const picked = Object.fromEntries(keys.map((k) => [k, selectedManifest[k]]))
    setStatusMsg(`Cherry-picked: ${keys.join(', ')} — paste into another capsule via console: ${JSON.stringify(picked)}`)
    setTimeout(() => setStatusMsg(null), 8000)
  }

  // ── render ────────────────────────────────────────────────────────────────
  const title = manifests.find((m) => m.parentIds.length === 0)?.title ?? 'Version Graph'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
        <button onClick={() => window.close()} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Close</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{title}</span>
        {statusMsg && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#166534', background: '#dcfce7', padding: '3px 10px', borderRadius: 5 }}>
            {statusMsg}
          </span>
        )}
      </div>

      {/* main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* graph */}
        <div style={{ flex: 1, position: 'relative' }}>
          {manifests.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
              Loading graph…
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          )}
        </div>

        {/* side panel */}
        {selectedManifest && (
          <div style={{ width: 300, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fafafa', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 6 }}>
                {selectedManifest.title}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={handleRollback} style={btnStyle('#2563eb')}>Rollback</button>
                <button onClick={handleBranch} style={btnStyle('#7c3aed')}>Branch</button>
                <button onClick={handleCherryPick} style={btnStyle('#059669')}>Cherry-pick</button>
              </div>
              {/* merge target picker */}
              <div style={{ marginTop: 8 }}>
                <select
                  value={mergeTargetId ?? ''}
                  onChange={(e) => setMergeTargetId(e.target.value || null)}
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', width: '100%' }}
                >
                  <option value=''>Merge with…</option>
                  {manifests
                    .filter((m) => m.id !== selectedId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.title.slice(0, 36)}</option>
                    ))}
                </select>
                {mergeTargetId && (
                  <button onClick={handleMerge} style={{ ...btnStyle('#d97706'), marginTop: 4, width: '100%' }}>
                    Run merge
                  </button>
                )}
              </div>
            </div>

            {/* diff panel */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {parentOfSelected ? (
                <DiffPanel from={parentOfSelected} to={selectedManifest} />
              ) : (
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>Root commit — no parent to diff.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {pendingMerge && (
        <MergeConflictModal
          result={pendingMerge.result}
          leftId={pendingMerge.leftId}
          rightId={pendingMerge.rightId}
          onResolve={handleConflictResolve}
          onCancel={() => setPendingMerge(null)}
        />
      )}
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 5,
    border: 'none',
    background: color,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  }
}
