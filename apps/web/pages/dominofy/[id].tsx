import React, { useCallback, useEffect, useMemo, useState } from "react";
import Canvas from "../../components/canvas";
import DominosPanel from "../../components/dominosPanel";
import DetailsPanel from "../../components/detailsPanel";
import LogsPanel, { WorkflowLog } from "../../components/LogsPanel";
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { DominoContext } from "../../contexts/dominoContext";
import { buildPipeline } from "../../../../shared/helpers/buildPipeline";
import { useRouter } from "next/router";
import { WorkflowsApi } from "../../apis/workflow.apis";
import { importWorkflow } from "../../helpers/workflowManager";
import { SSEProvider } from "@/contexts/sseContext";

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
    const [workflowId, setWorkflowId] = useState<string | undefined>();
    const [logs, setLogs] = useState<WorkflowLog[]>([]);
    const logsRef = React.useRef<WorkflowLog[]>([]);

    const [loading, setLoading] = useState(true);

    // Function to add logs
    useCallback((message: string, type: 'log' | 'info' | 'warn' | 'error' | 'success' = 'log', source?: string) => {
        const newLog: WorkflowLog = {
            id: Date.now().toString(),
            type,
            message,
            timestamp: new Date(),
            source
        };

        logsRef.current = [...logsRef.current, newLog].slice(-200); // Keep last 200 logs
        setLogs(logsRef.current);
    }, []);

    // Function to clear logs
    const clearLogs = useCallback(() => {
        logsRef.current = [];
        setLogs([]);
    }, []);

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
        buildPipeline(currentNodes, currentEdges);
    }, [nodes, edges]);

    const selectedNode = nodes.find((node) => node.selected);

    useEffect(() => {
        const hydrateWorkflow = async () => {
            if (workflow) {
                importWorkflow(JSON.stringify(workflow.visualJson), setNodes, setEdges, setWorkflowId, workflow.id, {
                    setNodes,
                    updatePipeline
                });
                // setNodes(workflow.visualJson?.nodes || []);
                // setEdges(workflow.visualJson?.edges || []);
                // setWorkflowId(workflow.id);
                setLoading(false);
                return;
            }

            if (!id || typeof window === "undefined") return;

            // Try loading from sessionStorage
            const cached = sessionStorage.getItem("workflow-cache");
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.id === id) {
                        importWorkflow(
                            JSON.stringify(parsed.visualJson),
                            setNodes,
                            setEdges,
                            setWorkflowId,
                            parsed.id,
                            { setNodes, updatePipeline }
                        );
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

                    importWorkflow(
                        JSON.stringify(json.visualJson),
                        setNodes,
                        setEdges,
                        setWorkflowId,
                        json.id,
                        { setNodes, updatePipeline }
                    );
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
        <SSEProvider>
            <DominoContext.Provider value={contextValue}>
                <div className="w-screen h-screen flex flex-col bg-dominofy-light-background dark:bg-dominofy-dark-background text-dominofy-light-text dark:text-dominofy-dark-text">
                    <div className="flex-1 relative overflow-hidden"
                        style={{ paddingBottom: '60px' }}   // ← 60 px = collapsedHeight
                    >
                        <ReactFlowProvider>
                            <Canvas
                                id="dominofy"
                                nodes={nodes}
                                setNodes={setNodes}
                                onNodesChange={onNodesChange}
                                edges={edges}
                                setEdges={setEdges}
                                onEdgesChange={onEdgesChange}
                                workflowId={workflowId}
                            />
                            <DominosPanel />
                            <DetailsPanel
                                selectedNode={selectedNode}
                                getNodes={() => nodes}
                                getEdges={() => edges}
                                setNodes={setNodes}
                                setEdges={setEdges}
                                updatePipeline={updatePipeline}
                                workflowId={workflowId!}
                            />
                        </ReactFlowProvider>
                    </div>
                    <LogsPanel
                        workflowId={workflowId!}
                        className="border-t border-gray-200 dark:border-gray-700"
                    />
                </div>
            </DominoContext.Provider>
        </SSEProvider>
    );
}
