// DominofyLayout.tsx

'use client';

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
    // heights for log panel
    const collapsedHeight = '60px';
    const defaultLogsHeight = '200px';
    const maxLogsHeight = '50vh';
    const dominosPanelBottomOffset = 60; // Ensure this matches the DominosPanel prop

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [workflowId, setWorkflowId] = useState<string>();
    const [logs, setLogs] = useState<WorkflowLog[]>([]); // This state is not directly used for rendering LogsPanel, but for context logic.
    const logsRef = React.useRef<WorkflowLog[]>([]); // The LogsPanel manages its own logs state internally now.
    const [loading, setLoading] = useState(true);

    // logs handlers (these are mainly for internal context logic, LogsPanel manages its own logs)
    useCallback((message: string, type: 'log' | 'info' | 'warn' | 'error' | 'success' = 'log', source?: string) => {
        const newLog: WorkflowLog = { id: Date.now().toString(), type, message, timestamp: new Date(), source };
        logsRef.current = [...logsRef.current, newLog].slice(-200);
        setLogs(logsRef.current);
    }, []);
    const clearLogs = useCallback(() => {
        logsRef.current = [];
        setLogs([]);
    }, []);

    const [connectionErrors, setConnectionErrors] = useState<string[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const erroredNodes = useMemo(
        () => Array.from(new Set([...connectionErrors, ...validationErrors])),
        [connectionErrors, validationErrors]
    );

    const router = useRouter();
    const { id } = router.query;
    const contextValue = {
        erroredNodes,
        setConnectionErrors,
        setValidationErrors,
        clearConnectionErrors: () => setConnectionErrors([]),
        clearValidationForDominoId: (dominoId: string) =>
            setValidationErrors(prev => prev.filter(errId => errId !== dominoId)),
    };

    const updatePipeline = useCallback((currentNodes = nodes, currentEdges = edges) => {
        buildPipeline(currentNodes, currentEdges);
    }, [nodes, edges]);

    const selectedNode = nodes.find(n => n.selected);

    useEffect(() => {
        const hydrateWorkflow = async () => {
            if (workflow) {
                importWorkflow(JSON.stringify(workflow.visualJson), setNodes, setEdges, setWorkflowId, workflow.id, { setNodes, updatePipeline });
                setLoading(false);
                return;
            }
            if (!id || typeof window === 'undefined') return;

            const cached = sessionStorage.getItem('workflow-cache');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.id === id) {
                        importWorkflow(JSON.stringify(parsed.visualJson), setNodes, setEdges, setWorkflowId, parsed.id, { setNodes, updatePipeline });
                        setLoading(false);
                        return;
                    }
                    sessionStorage.removeItem('workflow-cache');
                } catch {
                    console.warn('Invalid workflow in sessionStorage');
                    sessionStorage.removeItem('workflow-cache');
                }
            }

            try {
                const token = localStorage.getItem('token');
                if (!token) return router.push('/auth');
                const response = await WorkflowsApi.getWorkflowById(id as string, token, router);
                if (response?.ok) {
                    const json = await response.json();
                    importWorkflow(JSON.stringify(json.visualJson), setNodes, setEdges, setWorkflowId, json.id, { setNodes, updatePipeline });
                } else {
                    router.push('/error');
                }
            } catch (err) {
                console.error('Error loading workflow:', err);
                router.push('/error');
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
                    {/* This div is the main flex container for the horizontal layout */}
                    <div className="flex-1 flex h-full">
                        {/* Sidebar */}
                        <DominosPanel />
                        {/* Main content area: This div correctly uses flex-col to stack Canvas/Details and LogsPanel */}
                        {/* The main content area now has a bottom padding equal to the logs panel height */}
                        <div className="flex-1 flex flex-col relative overflow-hidden">
                            <ReactFlowProvider>

                                {/* This div acts as the main content space *above* the logs panel's intended area */}
                                <div className="flex-1 relative overflow-hidden"> {/* Add overflow-hidden here to prevent issues */}
                                    <Canvas
                                        id="dominofy"
                                        nodes={nodes}
                                        setNodes={setNodes}
                                        onNodesChange={onNodesChange}
                                        edges={edges}
                                        setEdges={setEdges}
                                        onEdgesChange={onEdgesChange}
                                        workflowId={workflowId!}
                                    />
                                    <DetailsPanel
                                        selectedNode={selectedNode}
                                        getNodes={() => nodes}
                                        getEdges={() => edges}
                                        setNodes={setNodes}
                                        setEdges={setEdges}
                                        updatePipeline={updatePipeline}
                                        workflowId={workflowId!}
                                    />
                                </div>
                                {/* The LogsPanel is now absolutely positioned at the bottom of THIS flex-1 container */}
                                {/* Its width will be constrained by this parent container */}
                                {/* Its bottom: 0 will sit flush against the paddingBottom of the main content area */}
                                {/* left: 0 and right: 0 are now important for the LogsPanel to stretch its full width within *this* container */}
                            </ReactFlowProvider>

                            {/* LogsPanel is now absolutely positioned within its parent `flex-1 flex flex-col relative` div */}
                            {/* This ensures it sits precisely at the bottom, overlapping the padding */}
                            <LogsPanel
                                workflowId={workflowId!}
                                className="absolute bottom-0 left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700"
                                collapsedHeight={collapsedHeight}
                                defaultHeight={defaultLogsHeight}
                            />
                        </div>
                    </div>
                </div>
            </DominoContext.Provider>
        </SSEProvider>
    );
}