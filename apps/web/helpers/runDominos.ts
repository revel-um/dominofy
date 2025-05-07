import { Node, Edge } from 'reactflow';
import buildPipeline from './buildPipeline';
import axios from 'axios';

/**
 * Executes connected "print" nodes by traversing EXEC_OUT → EXEC_IN path.
 */
export function runDominos(nodes: Node[], edges: Edge[]) {
    console.log("▶️ Running from top-level with nodes and edges");
    const pipeline = buildPipeline(nodes, edges);
    console.log("Pipeline:", pipeline);
}