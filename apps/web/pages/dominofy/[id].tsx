import React, { useCallback, useEffect, useMemo, useState } from "react";
import Canvas from "../../components/canvas";
import DominosPanel from "../../components/dominosPanel";
import DetailsPanel from "../../components/detailsPanel";
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { runDominos } from '../../helpers/runDominos';
import { DominoContext } from "../../contexts/dominoContext";
import buildPipeline from "../../helpers/buildPipeline";
import { useRouter } from "next/router";
import { WorkflowsApi } from "../../apis/workflow.apis";

interface Props {
    workflow?: {
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        visualJson: {
            edges: any[];
            nodes: any[];
        };
        isPublished: boolean;
        isDefault: boolean;
    };
}

export default function DominofyLayout({ workflow }: Props) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    const [connectionErrors, setConnectionErrors] = useState<string[]>([])
    const [validationErrors, setValidationErrors] = useState<string[]>([])

    const erroredNodes = useMemo(
        () => Array.from(new Set([...connectionErrors, ...validationErrors])),
        [connectionErrors, validationErrors]
    )

    const router = useRouter();
    const { id } = router.query;

    const contextValue = {
        erroredNodes,
        setConnectionErrors,
        setValidationErrors,
        clearConnectionErrors: () => setConnectionErrors([]),
        clearValidationErrors: () => setValidationErrors([]),
        clearValidationForDominoId: (id: string) => {
            setValidationErrors((prev) => prev.filter((errId) => errId !== id));
        },
    }

    const updatePipeline = useCallback((currentNodes = nodes, currentEdges = edges) => {
        const newPipeline = buildPipeline(currentNodes, currentEdges);
        console.log("Updated pipeline:", newPipeline);
    }, [nodes, edges]);

    console.log(nodes);
    const selectedNode = nodes.find((node) => node.selected);

    useEffect(() => {
        const hydrateWorkflow = async () => {
            if (workflow) {
                setNodes(workflow.visualJson?.nodes || []);
                setEdges(workflow.visualJson?.edges || []);
                setLoading(false);
                return;
            }

            if (!id || typeof window === "undefined") return;

            // Try loading from sessionStorage
            const cached = sessionStorage.getItem("workflow-cache");
            console.log("Cached workflow:", cached);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.id === id) {
                        setNodes(parsed.visualJson?.nodes || []);
                        setEdges(parsed.visualJson?.edges || []);
                        setLoading(false);
                        return;
                    } else {
                        sessionStorage.removeItem("workflow-cache");
                    }
                } catch (err) {
                    console.warn("Invalid workflow in sessionStorage");
                    sessionStorage.removeItem("workflow-cache");
                }
            }

            // Fallback: Fetch from API
            try {
                const token = localStorage.getItem("token");
                if (!token) return router.push("/auth");

                const response = await WorkflowsApi.getWorkflowById(id as string, token, router);

                if (response?.ok) {
                    const json = await response.json();
                    setNodes(json.visualJson?.nodes || []);
                    setEdges(json.visualJson?.edges || []);
                } else {
                    router.push("/error");
                }
            } catch (err) {
                console.error("Error loading workflow:", err);
                router.push("/error");
            } finally {
                setLoading(false);
            }
        };

        hydrateWorkflow();
    }, [id, workflow]);

    if (loading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center text-xl">
                Loading workflow...
            </div>
        );
    }

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
