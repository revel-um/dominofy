// // src/components/CanvasTabsLayout.tsx
// "use client";

// import React, { useCallback, useMemo, useState } from "react";
// import type { Node, Edge } from "reactflow";
// import { nanoid } from "nanoid";

// import Canvas from "./canvas"; // <= your Canvas.tsx
// import { WorkflowTabs } from "./workflowTabs";
// import type { WorkflowTab } from "../types/workflowTab";

// type CanvasTabsLayoutProps = {
//   // Optional initial workflow (e.g. opened from sidebar)
//   initialWorkflowId?: string;
//   initialTitle?: string;
//   initialNodes?: Node[];
//   initialEdges?: Edge[];

//   readonly?: boolean;

//   // If you already have a note tool toggle in some toolbar:
//   noteToolActive?: boolean;
//   onCancelInsertNote?: () => void;
// };

// function createEmptyTab(
//   title: string,
//   workflowId?: string,
//   nodes: Node[] = [],
//   edges: Edge[] = []
// ): WorkflowTab {
//   return {
//     id: nanoid(),
//     title,
//     workflowId,
//     nodes,
//     edges,
//     isDirty: false,
//   };
// }

// const CanvasTabsLayout: React.FC<CanvasTabsLayoutProps> = ({
//   initialWorkflowId,
//   initialTitle = "Workflow 1",
//   initialNodes = [],
//   initialEdges = [],
//   readonly = false,
//   noteToolActive = false,
//   onCancelInsertNote,
// }) => {
//   const [tabs, setTabs] = useState<WorkflowTab[]>(() => [
//     createEmptyTab(initialTitle, initialWorkflowId, initialNodes, initialEdges),
//   ]);

//   const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

//   const activeTab = useMemo(
//     () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
//     [tabs, activeTabId]
//   );

//   /* ───────── Tab operations ───────── */

//   const handleAddTab = useCallback(() => {
//     setTabs((prev) => {
//       const newTab = createEmptyTab(`Workflow ${prev.length + 1}`);
//       return [...prev, newTab];
//     });
//     // active tab will be set in a second useEffect or manually,
//     // but easiest: set it here by reading the newly created id:
//   }, []);

//   // safer: a version that sets active immediately
//   const addAndActivateTab = useCallback(() => {
//     setTabs((prev) => {
//       const newTab = createEmptyTab(`Workflow ${prev.length + 1}`);
//       const next = [...prev, newTab];
//       // set active to new tab
//       setActiveTabId(newTab.id);
//       return next;
//     });
//   }, []);

//   const handleSelectTab = useCallback((id: string) => {
//     setActiveTabId(id);
//   }, []);

//   const handleCloseTab = useCallback(
//     (id: string) => {
//       setTabs((prev) => {
//         if (prev.length === 1) return prev; // at least one tab

//         const idx = prev.findIndex((t) => t.id === id);
//         if (idx === -1) return prev;

//         const next = prev.filter((t) => t.id !== id);

//         if (activeTabId === id) {
//           const nextActive = next[Math.max(0, idx - 1)];
//           setActiveTabId(nextActive.id);
//         }

//         return next;
//       });
//     },
//     [activeTabId]
//   );

//   /* ───────── Setters for active tab nodes/edges ───────── */

//   const setNodesForActive = useCallback(
//     (updater: React.SetStateAction<Node[]>) => {
//       setTabs((prev) =>
//         prev.map((tab) => {
//           if (tab.id !== activeTabId) return tab;

//           const nextNodes =
//             typeof updater === "function"
//               ? (updater as (n: Node[]) => Node[])(tab.nodes)
//               : updater;

//           return {
//             ...tab,
//             nodes: nextNodes,
//             isDirty: true,
//           };
//         })
//       );
//     },
//     [activeTabId]
//   );

//   const setEdgesForActive = useCallback(
//     (updater: React.SetStateAction<Edge[]>) => {
//       setTabs((prev) =>
//         prev.map((tab) => {
//           if (tab.id !== activeTabId) return tab;

//           const nextEdges =
//             typeof updater === "function"
//               ? (updater as (e: Edge[]) => Edge[])(tab.edges)
//               : updater;

//           return {
//             ...tab,
//             edges: nextEdges,
//             isDirty: true,
//           };
//         })
//       );
//     },
//     [activeTabId]
//   );

//   /* ───────── Optional: expose a way to open workflow in new tab ───────── */
//   // You can call this from outside if you want:
//   // e.g. when user clicks "Open in new tab" in a sidebar.
//   const openWorkflowInNewTab = useCallback(
//     (opts: { workflowId: string; title: string; nodes: Node[]; edges: Edge[] }) => {
//       setTabs((prev) => {
//         // if already opened, just activate
//         const existing = prev.find((t) => t.workflowId === opts.workflowId);
//         if (existing) {
//           setActiveTabId(existing.id);
//           return prev;
//         }

//         const newTab = createEmptyTab(
//           opts.title,
//           opts.workflowId,
//           opts.nodes,
//           opts.edges
//         );
//         const next = [...prev, newTab];
//         setActiveTabId(newTab.id);
//         return next;
//       });
//     },
//     []
//   );

//   // TODO: you can export openWorkflowInNewTab via context or props if needed

//   /* ───────── Render ───────── */

//   if (!activeTab) return null;

//   return (
//     <div className="flex h-full flex-col">
//       <WorkflowTabs
//         tabs={tabs.map(({ id, title }) => ({ id, name: title }))}
//         activeTabId={activeTabId}
//         onSelectTab={handleSelectTab}
//         onCloseTab={handleCloseTab}
//         onAddTab={addAndActivateTab}
//       />

//       <div className="flex-1">
//         <Canvas
//           key={activeTab.id} // important: reset Canvas internal state per tab
//           id={`canvas-${activeTab.id}`}
//           nodes={activeTab.nodes}
//           setNodes={setNodesForActive}
//           edges={activeTab.edges}
//           setEdges={setEdgesForActive}
//           workflowId={activeTab.workflowId}
//           readonly={readonly}
//           noteToolActive={noteToolActive}
//           onCancelInsertNote={onCancelInsertNote}
//           // onUndo / onRedo can be wired per-tab later if you have history
//         />
//       </div>
//     </div>
//   );
// };

// export default CanvasTabsLayout;
