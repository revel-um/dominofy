import React, { useCallback, useMemo, useState } from "react";
import Canvas from "./canvas";
import DominosPanel from "./dominosPanel";
import DetailsPanel from "./detailsPanel";
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { runDominos } from '../helpers/runDominos';
import { DominoContext } from "../contexts/dominoContext";

export default function DominofyLayout() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const runDominosFlow = useCallback(() => {
        console.log("▶️ Running from top-level with nodes and edges");
        runDominos(nodes, edges);
    }, [nodes, edges]);

    const contextValue = useMemo(() => ({ runDominosFlow }), [runDominosFlow]);

    return (
        <DominoContext.Provider value={contextValue}>
            <div className="w-screen h-screen relative bg-dominofy-light-background dark:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text">
                <ReactFlowProvider>
                    <Canvas
                        nodes={nodes}
                        setNodes={setNodes}
                        onNodesChange={onNodesChange}
                        edges={edges}
                        setEdges={setEdges}
                        onEdgesChange={onEdgesChange}
                    />
                </ReactFlowProvider>
                <DominosPanel />
                <DetailsPanel />
            </div>
        </DominoContext.Provider>
    );
}
