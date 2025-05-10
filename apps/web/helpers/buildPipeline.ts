import { PipelineStep } from "../../../shared/types/pipelineStepType";
import { Node, Edge } from 'reactflow';

export default function buildPipeline(nodes: Node[], edges: Edge[]): PipelineStep[] {
    console.log('building....')
    const execEdges = edges.filter(e => e.sourceHandle?.startsWith('exec'));
    const pipeline: Record<string, PipelineStep> = {};
  
    nodes.forEach((node) => {
      const outgoing = execEdges
        .filter(edge => edge.source === node.id)
        .map(edge => edge.target);
  
      pipeline[node.id] = {
        id: node.id,
        type: node.type!,
        data: node.data,
        next: outgoing
      };
    });
  
    const data = Object.values(pipeline);
    return data;
  }
  