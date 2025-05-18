import React from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import Canvas from "../components/canvas"; // adjust the path if needed
import type { Node, Edge } from "reactflow";

interface Project {
    id: string;
    name: string;
    lastEdited: string;
}

const mockProjects: Project[] = [
    { id: "p1", name: "Marketing Automation", lastEdited: "5 min ago" },
    { id: "p2", name: "Salesforce Sync", lastEdited: "Yesterday" },
    { id: "p3", name: "Email Parser", lastEdited: "2 days ago" },
    { id: "p4", name: "Support Ticketing", lastEdited: "1 week ago" },
    { id: "p5", name: "Weekly Reports", lastEdited: "1 month ago" },
];

export default function DominofyDashboard() {
    /* replace these with the most‑recent workflow pulled from API / localStorage */
    const workflowNodes: Node[] = [];
    const workflowEdges: Edge[] = [];

    return (
        <div className="flex h-screen w-full bg-gray-50">
            {/* ─────────────────────── Left/Main column ─────────────────────── */}
            <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                {/* Greeting row */}
                <div className="flex items-center justify-between shrink-0">
                    <h1 className="text-2xl font-semibold text-gray-900">Welcome</h1>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                        Create new project
                    </button>
                </div>

                {/* Top statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                    {/* Profile card */}
                    <div className="relative rounded-2xl bg-white p-6 shadow-md flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-gray-200 mb-4" />
                        <p className="text-lg font-medium">Kristin Watson</p>
                        <p className="text-sm text-gray-500">Design Manager</p>
                    </div>

                    {/* Prioritized tasks */}
                    <div className="rounded-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-purple-100 p-6 shadow-md flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Prioritized tasks</p>
                            <p className="text-4xl font-bold mt-4">83%</p>
                            <p className="text-xs text-gray-600">Avg. completed</p>
                        </div>
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">Recent projects</button>
                    </div>

                    {/* Additional tasks */}
                    <div className="rounded-2xl bg-gradient-to-br from-cyan-200 via-blue-200 to-blue-100 p-6 shadow-md flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Additional tasks</p>
                            <p className="text-4xl font-bold mt-4">56%</p>
                            <p className="text-xs text-gray-600">Avg. completed</p>
                        </div>
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">Recent projects</button>
                    </div>
                </div>

                {/* Preview section */}
                <section className="flex-1 flex flex-col overflow-hidden">
                    <header className="shrink-0 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
                        <p className="text-xs text-gray-500">Snapshot of your current workflow</p>
                    </header>

                    {/* Full‑height Canvas card */}
                    <div className="flex-1 rounded-2xl bg-white shadow-md overflow-hidden">
                        <Canvas
                            nodes={workflowNodes}
                            edges={workflowEdges}
                            readonly={true}
                        />
                    </div>
                </section>
            </div>

            {/* ─────────────────────── Right sidebar ─────────────────────── */}
            <aside className="w-[352px] border-l border-gray-200 bg-white h-full flex flex-col">
                {/* Search bar & profile */}
                <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center flex-1 bg-gray-100 rounded-full px-3 py-2">
                        <FiSearch className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search projects…"
                            className="bg-transparent flex-1 text-sm focus:outline-none"
                        />
                    </div>
                    <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
                        <FiUser className="text-gray-500" />
                    </button>
                </div>

                {/* Project list */}
                <div className="flex-1 overflow-y-auto">
                    <h3 className="px-4 pt-2 pb-1 text-sm font-semibold text-gray-600">Projects</h3>
                    <ul className="space-y-1 px-2">
                        {mockProjects.map((project) => (
                            <li
                                key={project.id}
                                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 cursor-pointer group">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-dominofy-primary">
                                        {project.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">Edited {project.lastEdited}</p>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4 text-gray-300 group-hover:text-dominofy-primary">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </div>
    );
}
