// pages/builder/[id].tsx
import React, { useCallback, useState } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  Connection,
  Node,
  Edge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import 'reactflow/dist/style.css'

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

function FlowCanvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')

      if (!type) return

      const position = {
        x: event.clientX - 250, // Adjust for sidebar width
        y: event.clientY,
      }

      const newNode: Node = {
        id: `${+new Date()}`,
        type: 'default',
        position,
        data: { label: `${type} Node` },
      }

      setNodes((nds) => [...nds, newNode])
    },
    []
  )

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  )

  return (
    <div className="flex w-screen h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4 border-r">
        <p className="font-semibold mb-2">Node Types</p>
        {['Trigger', 'Action', 'Condition'].map((type) => (
          <div
            key={type}
            className="p-2 mb-2 bg-white rounded shadow cursor-pointer text-sm text-center border"
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData('application/reactflow', type)
            }
          >
            {type}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div
        className="flex-1 bg-white"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
          onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
          onConnect={(connection) => setEdges((eds) => addEdge(connection, eds))}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </div>
    </div>
  )
}

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  )
}
