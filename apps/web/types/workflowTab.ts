// src/types/workflowTab.ts
import type { Node, Edge } from "reactflow";

export type WorkflowTab = {
  id: string;          // internal tab id
  title: string;       // label shown in the tab
  nodes: Node[];
  edges: Edge[];
  workflowId?: string; // your backend workflow id
  isDirty?: boolean;   // show "*" if unsaved
};
