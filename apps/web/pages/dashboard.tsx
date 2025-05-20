import React, { useEffect, useState } from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import Canvas from "../components/canvas";
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
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [pageCache, setPageCache] = useState<Record<string, Project[]>>({});
    const [query, setQuery] = useState("");

    const workflowNodes: Node[] = [];
    const workflowEdges: Edge[] = [];

    const router = useRouter();

    const fetchProjects = async () => {
        const token = localStorage.getItem("token");
        if (!token) return router.push("/auth");

        const offset = (page - 1) * limit;
        const cacheKey = `${page}-${limit}-${query}`;

        if (pageCache[cacheKey]) {
            setProjects(pageCache[cacheKey]);
            return;
        }

        try {
            const response = await ProjectsApi.getProjects(token, router, limit, offset, query);
            if (!response?.ok) return;

            const { data, count } = await response.json();
            const formatted = data.map((p: any) => ({
                id: p.id,
                name: p.name,
                lastEdited: formatDate(p.updatedAt),
            }));

            setProjects(formatted);
            setPageCache((prev) => ({ ...prev, [cacheKey]: formatted }));
            setTotalPages(Math.max(1, Math.ceil(count / limit))); // Ensure at least 1 page
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [page, limit, query]);

    async function createProject(name: string, description?: string) {
        const token = localStorage.getItem("token");
        if (!token) return router.push("/auth");

        const response = await ProjectsApi.createProject(token, router, { name, description });
        if (response?.ok) {
            setPageCache({});
            setPage(1);
        } else {
            console.error("Error creating project:", response);
        }
    }

    const handlePrev = () => {
        if (page > 1) setPage(page - 1);
    };

    const handleNext = () => {
        if (page < totalPages) setPage(page + 1);
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(e.target.value);
        setLimit(newLimit);
        setPageCache({});
        setPage(1);
    };

    return (
        <div className="flex h-screen w-full bg-gray-50">
            <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <h1 className="text-2xl font-semibold text-gray-900">Welcome</h1>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
                        onClick={() => setIsModalOpen(true)}
                    >
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
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">
                            Recent projects
                        </button>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-cyan-200 via-blue-200 to-blue-100 p-6 shadow-md flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Additional tasks</p>
                            <p className="text-4xl font-bold mt-4">56%</p>
                            <p className="text-xs text-gray-600">Avg. completed</p>
                        </div>
                        <button className="self-end mt-4 text-xs bg-white/30 px-3 py-1 rounded-full">
                            Recent projects
                        </button>
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
                            value={query}
                            onChange={(e) => {
                                const value = e.target.value;
                                setQuery(value);
                                setPageCache({});
                                setPage(1);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setPage(1);
                                }
                            }}
                        />
                    </div>
                    <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100">
                        <FiUser className="text-gray-500" />
                    </button>
                </div>

                <hr className="border-t border-gray-200 w-full" />

                <div className="flex-1 overflow-y-auto">
                    <h3 className="px-4 pt-2 pb-1 text-sm font-semibold text-gray-600">Projects</h3>
                    <ul className="space-y-1 px-2">
                        {projects.map((project) => (
                            <li
                                key={project.id}
                                className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-dominofy-primary">
                                        {project.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                        {project.lastEdited}
                                    </p>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4 text-gray-300 group-hover:text-dominofy-primary"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="border-t p-4 bg-white sticky bottom-0 z-10 flex justify-center items-center gap-4">
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm ${page === 1 ? "text-gray-300 border-gray-200" : "text-blue-600 border-blue-300 hover:bg-blue-50"
                            }`}
                    >
                        &lt;
                    </button>

                    <span className="text-sm text-gray-700 whitespace-nowrap min-w-[60px] text-center">
                        <strong>{page}</strong> / {totalPages}
                    </span>

                    <button
                        onClick={handleNext}
                        disabled={page === totalPages}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm ${page === totalPages
                            ? "text-gray-300 border-gray-200"
                            : "text-blue-600 border-blue-300 hover:bg-blue-50"
                            }`}
                    >
                        &gt;
                    </button>

                    <div className="ml-2 flex items-center text-sm text-gray-600 gap-1">
                        <select
                            value={limit}
                            onChange={handleLimitChange}
                            className="px-3 py-1 rounded-full border border-blue-300 text-sm focus:outline-none"
                        >
                            {[5, 10, 20, 50].map((val) => (
                                <option key={val} value={val}>
                                    {val}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm">/Page</span>
                    </div>
                </div>
            </aside>

            <ToastContainer position="top-right" autoClose={5000} hideProgressBar />

            <CreateProjectModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={(name, description) => {
                    createProject(name, description);
                }}
            />
        </div>
    );
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "2-digit",
    };
    const formatted = date.toLocaleDateString("en-US", options);
    const [month, day, year] = formatted.replace(",", "").split(" ");
    return `${month}-${day}-${year}`;
}
