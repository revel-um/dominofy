// src/hooks/useCopyPaste.ts
import { Edge, Node, useReactFlow } from 'reactflow';
import { useCallback } from 'react';
import {
  buildClipboardPayload,
  materializePaste,
  readClipboard,
  writeClipboard,
} from '../utils/clipboard';

type Options = {
  addAction?: <T>(label: string, fn: () => T) => T; // your undo/redo wrapper
};

export function useCopyPaste(
  nodes: Node[],
  edges: Edge[],
  setNodes: (updater: (prev: Node[]) => Node[]) => void,
  setEdges: (updater: (prev: Edge[]) => Edge[]) => void,
  opts?: Options
) {
  // Try to access ReactFlow store (safe fallback if not wrapped in ReactFlowProvider)
  let screenToFlowPosition: ((pos: { x: number; y: number }) => { x: number; y: number }) | undefined;
  try {
    const rf = useReactFlow();
    screenToFlowPosition = rf.screenToFlowPosition;
  } catch {
    // fallback: identity fn (returns raw coords)
    screenToFlowPosition = (pos) => pos;
  }

  const copy = useCallback(async () => {
    const payload = buildClipboardPayload(nodes, edges);
    if (!payload.nodes.length) return;
    await writeClipboard(payload);
  }, [nodes, edges]);

  const cut = useCallback(async () => {
    const payload = buildClipboardPayload(nodes, edges);
    if (!payload.nodes.length) return;
    await writeClipboard(payload);

    const exec = () => {
      const selectedIds = new Set(payload.nodes.map((n) => n.id));
      setNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setEdges((prev) =>
        prev.filter((e) => !(selectedIds.has(e.source) && selectedIds.has(e.target)))
      );
    };

    if (opts?.addAction) opts.addAction('Cut selection', exec);
    else exec();
  }, [nodes, edges, setNodes, setEdges, opts]);

  const pasteAtPoint = useCallback(
    async (clientX?: number, clientY?: number) => {
      const payload = await readClipboard();
      if (!payload || !payload.nodes.length) return;

      const dropAt =
        clientX != null && clientY != null
          ? screenToFlowPosition!({ x: clientX, y: clientY })
          : undefined;

      const { nodes: newNodes, edges: newEdges } = materializePaste(payload, dropAt);

      const exec = () => {
        setNodes((prev) => {
          const cleared = prev.map((n) => ({ ...n, selected: false }));
          return [...cleared, ...newNodes];
        });
        setEdges((prev) => {
          const cleared = prev.map((e) => ({ ...e, selected: false }));
          return [...cleared, ...newEdges];
        });
      };

      if (opts?.addAction) opts.addAction('Paste', exec);
      else exec();
    },
    [setNodes, setEdges, screenToFlowPosition, opts]
  );

  return { copy, cut, pasteAtPoint };
}
