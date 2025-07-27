// pages/test-switch-domino.tsx
import React from 'react'
import { ReactFlowProvider } from 'reactflow'
import SwitchDomino from '@/dominos/switchCase'
import { DominoContext } from '@/contexts/dominoContext'
import type { DominoContextType } from '@/contexts/dominoContext'
import type { NodeProps } from 'reactflow'

export default function TestSwitchDominoPage() {
  // 1️⃣ Fake the details.fields you’d normally get from your backend
  const fakeFields = [
    { heading: 'Case_Default', value: 'DefaultValue' },
    { heading: 'Case_1',       value: 'One' },
    { heading: 'Case_2',       value: 'Two' },
  ]

  // 2️⃣ Fake node.data
  const fakeData = {
    details: { fields: fakeFields },
    suggested: true,
    // if you want editing, you can also inject setNodes/setEdges here
  }

  // 3️⃣ Stub out your full DominoContextType
  const dominoCtx: DominoContextType = {
    erroredNodes: [],
    clearValidationForDominoId: (_id: string) => {},
    setConnectionErrors: (_ids: string[]) => {},
    setValidationErrors: (_ids: string[]) => {},
    clearConnectionErrors: () => {},
  }

  // 4️⃣ Build a complete NodeProps<T> object
  const fakeNodeProps: NodeProps<typeof fakeData> = {
    id: 'test-switch-1',
    data: fakeData,
    selected: false,
    type: 'switch',       // must match your SwitchDomino’s type
    xPos: 50,
    yPos: 50,
    zIndex: 1,
    isConnectable: true,
    dragHandle: undefined, // or a CSS selector string if you use one
    dragging: false,
  }

  return (
    <div style={{ padding: 20, background: '#f3f4f6', height: '100vh' }}>
      <h2>🔧 SwitchDomino Test</h2>
      <ReactFlowProvider>
        <DominoContext.Provider value={dominoCtx}>
          {/* Spread in *all* NodeProps so TS is happy: */}
          <SwitchDomino {...fakeNodeProps} />
        </DominoContext.Provider>
      </ReactFlowProvider>
    </div>
  )
}
