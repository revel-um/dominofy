import React, { useState, useRef } from 'react';
import { FiPlay, FiTool } from 'react-icons/fi'; // ✅ Added FiTool icon
import { useDomino } from '../contexts/dominoContext';
import { Edge, Node, useReactFlow } from 'reactflow';
import { DominoField, fieldWidgetMap } from '../types/dominoFieldTypes';
import { exportWorkflow, importWorkflow } from '../helpers/workflowManager';
import buildPipeline from '../helpers/buildPipeline';
import { get } from 'http';

interface DetailsPanelProps {
    selectedNode: Node | undefined;
    getNodes: () => Node[];
    getEdges: () => Edge[];
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    updatePipeline: (currentNodes?: Node[], currentEdges?: Edge[]) => void;
}

export default function DetailsPanel({ selectedNode, getNodes, getEdges, setNodes, setEdges, updatePipeline }: DetailsPanelProps) {
    const { runDominosFlow } = useDomino();

    const MIN_WIDTH = 280;
    const MAX_WIDTH = 480;
    const [width, setWidth] = useState(MIN_WIDTH);
    const isDragging = useRef(false);

    const handleMouseDown = () => {
        isDragging.current = true;
        document.body.classList.add('select-none');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: { clientX: number; }) => {
        if (!isDragging.current) return;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
        setWidth(newWidth);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.body.classList.remove('select-none');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const jsonRef = useRef<any>(null); // holds exported json
    const onBuild = () => {
        const exported = exportWorkflow(getNodes(), getEdges());
        console.log('Exported Workflow JSON:', exported);
        jsonRef.current = exported;
    };

    const onDeploy = () => {
        importWorkflow(jsonRef.current, setNodes, setEdges, {
            setNodes,
            updatePipeline,
        });
    };

    const onRun = () => {
        const pipeline = buildPipeline(getNodes(), getEdges());
    }

    return (
        <div
            className="absolute top-0 right-0 h-full z-10 bg-dominofy-light-panel dark:bg-dominofy-dark-panel flex flex-col"
            style={{ width }}
        >
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-dominofy-light-text dark:text-dominofy-dark-text">Details</h2>
                <div className="flex items-center gap-3">
                    <FiPlay
                        onClick={onRun}
                        className="text-2xl cursor-pointer text-dominofy-light-text dark:text-dominofy-dark-text hover:opacity-80"
                    />
                    <FiTool
                        onClick={onBuild}
                        className="text-2xl cursor-pointer text-dominofy-light-text dark:text-dominofy-dark-text hover:opacity-80"
                        title="Build"
                    />
                    <button
                        onClick={onDeploy}
                        className="px-4 py-1.5 rounded text-sm font-medium text-white bg-dominofy-light-accent dark:bg-dominofy-dark-accent hover:opacity-90 transition"
                    >
                        Deploy
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                {selectedNode?.data?.details && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-dominofy-light-text dark:text-dominofy-dark-text">
                            {selectedNode.data.details.type}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400">
                            {selectedNode.data.details.description}
                        </p>

                        <div className="space-y-5 pt-2">
                            {selectedNode.data.details.fields.map((field: DominoField, idx: React.Key) => {
                                const Widget = fieldWidgetMap[field.type as keyof typeof fieldWidgetMap];
                                if (!Widget) {
                                    return <div key={idx}>Unsupported widget: {field.type}</div>;
                                }

                                return (
                                    <div key={idx} className="flex flex-col space-y-1">
                                        {field.heading && (
                                            <label className="font-medium text-sm text-dominofy-light-text dark:text-dominofy-dark-text">
                                                {field.heading}
                                            </label>
                                        )}
                                        <Widget
                                            value={field.value}
                                            options={field.options}
                                            placeholder={field.placeholder}
                                            required={field.required}
                                            onChange={(val: any) => {
                                                selectedNode.data.setFieldValue(field.heading, val);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div>
                    <p className="text-xs text-gray-500 mb-1">Raw Data</p>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedNode?.data, null, 2)}
                    </pre>
                </div>
            </div>

            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize bg-transparent"
            />
        </div>
    );
}
