import React, { useEffect, useState } from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import Canvas from "../components/canvas"; // adjust the path if needed
import type { Node, Edge } from "reactflow";
import { ProjectsApi } from "../apis/projects.apis";
import { ToastContainer } from "react-toastify";
import { useRouter } from "next/router";
import CreateProjectModal from "../components/modals/createProjectModal";

interface Project {
    id: string;
    name: string;
    lastEdited: string;
}

export default function DominofyDashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const workflowNodes: Node[] = [];
    const workflowEdges: Edge[] = [];

    const router = useRouter();
    useEffect(() => {
        const fetchProjects = async () => {
            const token = localStorage.getItem("token"); // or sessionStorage.getItem("token")
            if (!token) return router.push("/auth")

            try {
                const response = await ProjectsApi.getProjects(token, router);
                console.log("response", response);
                if (!response?.ok) return;

                const data = (await response.json() as any).data;

                // You may need to adjust this transformation based on actual API response
                console.log("data", data);
                const formatted = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    lastEdited: timeSince(p.updatedAt), // Utility to make it "5 min ago", etc.
                }));

                setProjects(formatted);
            } catch (err) {
                console.error("Error fetching projects:", err);
            }
        };

        fetchProjects();
    }, []);

    async function createProject(name: string, description?: string) {
        const token = localStorage.getItem("token");
        if (!token) return router.push("/auth")

        ProjectsApi.createProject(token, router, { name, description })
    }

    return (
        <div className="flex h-screen w-full bg-gray-50">
            <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <h1 className="text-2xl font-semibold text-gray-900">Welcome</h1>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap" onClick={() => setIsModalOpen(true)}>
                        Create new project
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                    <div className="relative rounded-2xl bg-white p-6 shadow-md flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-gray-200 mb-4" />
                        <p className="text-lg font-medium">Kristin Watson</p>
                        <p className="text-sm text-gray-500">Design Manager</p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-purple-100 p-6 shadow-md flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Prioritized tasks</p>
                            <p className="text-4xl font-bold mt-4">83%</p>
                            <p className="text-xs text-gray-600">Avg. completed</p>
                        </div>
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">Recent projects</button>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-cyan-200 via-blue-200 to-blue-100 p-6 shadow-md flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Additional tasks</p>
                            <p className="text-4xl font-bold mt-4">56%</p>
                            <p className="text-xs text-gray-600">Avg. completed</p>
                        </div>
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">Recent projects</button>
                    </div>
                </div>

                <section className="flex-1 flex flex-col overflow-hidden">
                    <header className="shrink-0 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
                        <p className="text-xs text-gray-500">Snapshot of your current workflow</p>
                    </header>
                    <div className="flex-1 rounded-2xl bg-white shadow-md overflow-hidden">
                        <Canvas nodes={workflowNodes} edges={workflowEdges} readonly={true} />
                    </div>
                </section>
            </div>

            <aside className="w-[352px] border-l border-gray-200 bg-white h-full flex flex-col">
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

                <div className="flex-1 overflow-y-auto">
                    <h3 className="px-4 pt-2 pb-1 text-sm font-semibold text-gray-600">Projects</h3>
                    <ul className="space-y-1 px-2">
                        {projects.map((project) => (
                            <li
                                key={project.id}
                                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 cursor-pointer group">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-dominofy-primary">
                                        {project.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">Edited {project.lastEdited}</p>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                                    viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                                    className="w-4 h-4 text-gray-300 group-hover:text-dominofy-primary">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
            {/* <ToastContainer position="top-right" autoClose={5000} hideProgressBar /> */}
            <CreateProjectModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={(name, description) => {
                    // call your create-project API here
                    console.log("New project:", { name, description });
                    createProject(name, description);
                    // then refresh list or redirect as needed
                }}
            />

        </div>
    );
}

// Utility: converts ISO date to relative time
function timeSince(dateString: string) {
    const now = new Date();
    const updated = new Date(dateString);
    const seconds = Math.floor((now.getTime() - updated.getTime()) / 1000);

    const intervals: [number, string][] = [
        [60, "seconds"],
        [60, "minutes"],
        [24, "hours"],
        [7, "days"],
        [4.35, "weeks"],
        [12, "months"],
        [Infinity, "years"],
    ];

    let duration = seconds;
    let unit = "seconds";

    for (const [divisor, name] of intervals) {
        if (duration < divisor) break;
        duration /= divisor;
        unit = name;
    }

    return `${Math.floor(duration)} ${unit} ago`;
}
