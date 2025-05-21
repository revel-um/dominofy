import React, { useCallback, useMemo, useState } from "react";
import Canvas from "../components/canvas";
import DominosPanel from "../components/dominosPanel";
import DetailsPanel from "../components/detailsPanel";
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { runDominos } from '../helpers/runDominos';
import { DominoContext } from "../contexts/dominoContext";
import buildPipeline from "../helpers/buildPipeline";

export default function DominofyLayout() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [erroredNodes, setErroredNodes] = useState<string[]>([]); // Add this

    const runDominosFlow = useCallback(() => {
        // You might want to actually capture errors here later
        runDominos(nodes, edges);
    }, [nodes, edges]);

    const contextValue = useMemo(
        () => ({ runDominosFlow, erroredNodes }),
        [runDominosFlow, erroredNodes]
    );

    const updatePipeline = useCallback((currentNodes = nodes, currentEdges = edges) => {
        // implement your logic (or import it from helper)
        const newPipeline = buildPipeline(currentNodes, currentEdges);
        // maybe set some state or just log
        console.log("Updated pipeline:", newPipeline);
    }, [nodes, edges]);


    const selectedNode = nodes.find((node) => node.selected);

    return (
        <DominoContext.Provider value={contextValue}>
            <div className="w-screen h-screen relative bg-dominofy-light-background dark:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text">
                <ReactFlowProvider>
                    <Canvas
                        id="dominofy"
                        nodes={nodes}
                        setNodes={setNodes}
                        onNodesChange={onNodesChange}
                        edges={edges}
                        setEdges={setEdges}
                        onEdgesChange={onEdgesChange}
                    />
                    <DominosPanel />
                    <DetailsPanel
                        selectedNode={selectedNode}
                        getNodes={() => nodes}
                        getEdges={() => edges}
                        setNodes={setNodes}
                        setEdges={setEdges}
                        updatePipeline={updatePipeline}
                    />
                </ReactFlowProvider>
            </div>
        </DominoContext.Provider>
    );
}

