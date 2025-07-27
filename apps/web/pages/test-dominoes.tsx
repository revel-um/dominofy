// pages/test-dominos.tsx
'use client';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import Canvas from '@/components/canvas';
import fakeWorkflow from './fakeWorkflow.json'; // Adjust path as needed

export default function TestDominosPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(fakeWorkflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(fakeWorkflow.edges);

  return (
    <div style={{ width: 800, height: 600 }}>
      <ReactFlowProvider>
        <Canvas
        id="test-canvas"
          nodes={nodes}
          setNodes={setNodes}
          onNodesChange={onNodesChange}
          edges={edges}
          setEdges={setEdges}
          onEdgesChange={onEdgesChange}
          readonly={true}   // so you don’t accidentally break your real layout
        />
      </ReactFlowProvider>
    </div>
  );
}
