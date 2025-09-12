import React, { useEffect, useState } from "react";
import Canvas from "../components/canvas";
import { ProjectsApi } from "../apis/projects.apis";
import { ToastContainer, toast } from "react-toastify";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import CreateProjectModal from "../components/modals/createProjectModal";
import DashboardInsightsPanel from "../components/dashbaordInsights";
import { WorkflowsApi } from "../apis/workflow.apis";
import {
    FiUsers,
    FiCheckCircle,
    FiAward,
    FiClock,
    FiCheck,
    FiSearch,
    FiChevronRight,
    FiPlus,
    FiExternalLink,
} from "react-icons/fi";
import TemplatesCanvas from "../components/templateCarousel";
import { useNodesState, useEdgesState } from "reactflow";
import { config } from "../config/config";

interface Project {
    id: string;
    name: string;
    lastEdited: string;
    description?: string;
}

interface Workflow {
    id: string;
    name: string;
    isPublished: boolean;
    isDefault: boolean;
    visualJson: { nodes: any[]; edges: [] };
    createdAt: Date;
    updatedAt: Date;
}

interface User {
    name: string;
    email: string;
}

export default function DominofyDashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [pageCache, setPageCache] = useState<Record<string, Project[]>>({});
    const [query, setQuery] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [recentWorkflow, setRecentWorkflow] = useState<Workflow>();
    const [projectCount, setProjectCount] = useState(0);
    const [workflowCount, setWorkflowCount] = useState(0);
    const [user, setUser] = useState<User>({ name: "", email: "" });
    const [templates, setTemplates] = useState<any[]>([]);
    const [isExchanging, setIsExchanging] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const router = useRouter();
    const { status, data: session } = useSession();


    // Helpers -------------------------------------------------------------
    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
            year: "numeric",
            month: "short",
            day: "2-digit",
        };
        const formatted = date.toLocaleDateString("en-US", options);
        const [month, day, year] = formatted.replace(",", "").split(" ");
        return `${month}-${day}-${year}`;
    };

    // Data ----------------------------------------------------------------
    const fetchProjects = async () => {
        // Wait until NextAuth resolves the session (undefined means pending in v5)
        if (session === undefined) return;
        const token = localStorage.getItem("token");
        let currentToken = token;
        // If user is unauthenticated via NextAuth and also no backend token, redirect to /auth
        if (!token && status === "unauthenticated") return router.push("/auth");
        // If authenticated via NextAuth but backend token is missing, try exchanging for a backend token
        if (!token && status === "authenticated") {
            setIsExchanging(true);
            try {
                const resp = await fetch('/api/auth/exchange', { method: 'POST' });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.token) {
                        localStorage.setItem('token', data.token);
                        currentToken = data.token;
                        setIsExchanging(false);
                    } else {
                        console.warn('Exchange succeeded but no token returned');
                        setProjects([]);
                        setProjectCount(0);
                        setIsExchanging(false);
                        return;
                    }
                } else {
                    const text = await resp.text();
                    console.error('Exchange failed:', text);
                    setProjects([]);
                    setProjectCount(0);
                    setIsExchanging(false);
                    return;
                }
            } catch (e) {
                console.error('Exchange error:', e);
                setProjects([]);
                setProjectCount(0);
                setIsExchanging(false);
                return;
            }
        }
        // If authenticated via NextAuth but no backend token, use NextAuth session for user card
        if (!token && status === "authenticated") {
            if (session?.user) {
                setUser({ name: session.user.name || "", email: session.user.email || "" });
            }
            return; // Skip backend fetches gracefully
        }

        const offset = (page - 1) * limit;
        const cacheKey = `${page}-${limit}-${query}`;

        if (pageCache[cacheKey]) {
            setProjects(pageCache[cacheKey]);
            return;
        }

        try {
            setTemplates([
                {
                    "nodes": [
                        {
                            "id": "apicall-1747853297703",
                            "type": "apicall",
                            "position": {
                                "x": 657.9512122441635,
                                "y": 387.5031132874231
                            },
                            "data": {
                                "label": "apicall node",
                                "value": "",
                                "exportFields": [
                                    "Url",
                                    "Method",
                                    "Headers",
                                    "Body"
                                ],
                                "details": {
                                    "type": "ApiCall",
                                    "description": "This domino sends an HTTP request to a specified Url with optional headers and body.",
                                    "fields": [
                                        {
                                            "type": "textInput",
                                            "heading": "Url",
                                            "placeholder": "https://api.example.com",
                                            "value": "",
                                            "required": true
                                        },
                                        {
                                            "type": "dropdown",
                                            "heading": "Method",
                                            "value": "GET",
                                            "required": true,
                                            "options": [
                                                {
                                                    "label": "GET",
                                                    "value": "GET"
                                                },
                                                {
                                                    "label": "POST",
                                                    "value": "POST"
                                                },
                                                {
                                                    "label": "PUT",
                                                    "value": "PUT"
                                                },
                                                {
                                                    "label": "DELETE",
                                                    "value": "DELETE"
                                                }
                                            ]
                                        },
                                        {
                                            "type": "json",
                                            "heading": "Headers",
                                            "placeholder": "{\"Authorization\": \"Bearer xyz\"}",
                                            "value": {}
                                        },
                                        {
                                            "type": "json",
                                            "heading": "Body",
                                            "placeholder": "{\"key\": \"value\"}",
                                            "value": {}
                                        }
                                    ]
                                },
                                "selected": true
                            }
                        },
                        {
                            "id": "print-1747853302476",
                            "type": "print",
                            "position": {
                                "x": 897.4005565158732,
                                "y": 404.7849790551566
                            },
                            "data": {
                                "label": "print node",
                                "value": "",
                                "details": {
                                    "type": "Print",
                                    "description": "This domino prints a given value.",
                                    "fields": [
                                        {
                                            "type": "textInput",
                                            "placeholder": "What to print ...",
                                            "value": "",
                                            "required": true,
                                            "heading": "Text"
                                        }
                                    ]
                                },
                                "exportFields": [
                                    "Text"
                                ],
                                "valueConnected": true,
                                "selected": false
                            }
                        }
                    ],
                    "edges": [
                        {
                            "id": "reactflow__edge-apicall-1747853297703exec_out-print-1747853302476exec_in",
                            "source": "apicall-1747853297703",
                            "target": "print-1747853302476",
                            "sourceHandle": "exec_out",
                            "targetHandle": "exec_in"
                        },
                        {
                            "id": "reactflow__edge-apicall-1747853297703value_out-print-1747853302476value_in",
                            "source": "apicall-1747853297703",
                            "target": "print-1747853302476",
                            "sourceHandle": "value_out",
                            "targetHandle": "value_in"
                        }
                    ]
                },
                {
                    "nodes": [
                        {
                            "id": "apicall-1747853297703",
                            "type": "apicall",
                            "position": {
                                "x": 657.9512122441635,
                                "y": 387.5031132874231
                            },
                            "data": {
                                "label": "apicall node",
                                "value": "",
                                "exportFields": [
                                    "Url",
                                    "Method",
                                    "Headers",
                                    "Body"
                                ],
                                "details": {
                                    "type": "ApiCall",
                                    "description": "This domino sends an HTTP request to a specified Url with optional headers and body.",
                                    "fields": [
                                        {
                                            "type": "textInput",
                                            "heading": "Url",
                                            "placeholder": "https://api.example.com",
                                            "value": "",
                                            "required": true
                                        },
                                        {
                                            "type": "dropdown",
                                            "heading": "Method",
                                            "value": "GET",
                                            "required": true,
                                            "options": [
                                                {
                                                    "label": "GET",
                                                    "value": "GET"
                                                },
                                                {
                                                    "label": "POST",
                                                    "value": "POST"
                                                },
                                                {
                                                    "label": "PUT",
                                                    "value": "PUT"
                                                },
                                                {
                                                    "label": "DELETE",
                                                    "value": "DELETE"
                                                }
                                            ]
                                        },
                                        {
                                            "type": "json",
                                            "heading": "Headers",
                                            "placeholder": "{\"Authorization\": \"Bearer xyz\"}",
                                            "value": {}
                                        },
                                        {
                                            "type": "json",
                                            "heading": "Body",
                                            "placeholder": "{\"key\": \"value\"}",
                                            "value": {}
                                        }
                                    ]
                                },
                                "selected": true
                            }
                        },
                        {
                            "id": "print-1747853302476",
                            "type": "print",
                            "position": {
                                "x": 897.4005565158732,
                                "y": 404.7849790551566
                            },
                            "data": {
                                "label": "print node",
                                "value": "",
                                "details": {
                                    "type": "Print",
                                    "description": "This domino prints a given value.",
                                    "fields": [
                                        {
                                            "type": "textInput",
                                            "placeholder": "What to print ...",
                                            "value": "",
                                            "required": true,
                                            "heading": "Text"
                                        }
                                    ]
                                },
                                "exportFields": [
                                    "Text"
                                ],
                                "valueConnected": true,
                                "selected": false
                            }
                        }
                    ],
                    "edges": [
                        {
                            "id": "reactflow__edge-apicall-1747853297703exec_out-print-1747853302476exec_in",
                            "source": "apicall-1747853297703",
                            "target": "print-1747853302476",
                            "sourceHandle": "exec_out",
                            "targetHandle": "exec_in"
                        },
                        {
                            "id": "reactflow__edge-apicall-1747853297703value_out-print-1747853302476value_in",
                            "source": "apicall-1747853297703",
                            "target": "print-1747853302476",
                            "sourceHandle": "value_out",
                            "targetHandle": "value_in"
                        }
                    ]
                }
            ])
            const response = await ProjectsApi.getProjects(
                currentToken ?? "",
                router,
                limit,
                offset,
                query,
            );
            if (!response?.ok) return;

            const { data, count } = await response.json();
            const formatted = data.map((p: any) => ({
                id: p.id,
                name: p.name,
                lastEdited: formatDate(p.updatedAt),
                description: p.description,
            }));

            setProjects(formatted);
            setProjectCount(count);
            setPageCache((prev) => ({ ...prev, [cacheKey]: formatted }));
            setTotalPages(Math.max(1, Math.ceil(count / limit)));

            const workflowResponse = await WorkflowsApi.getRecentWorkflowsAndCount(
                currentToken ?? "",
                router,
            );
            if (!workflowResponse?.ok) return;

            const { workflows, count: wfCount, user } = await workflowResponse.json();
            setUser({ name: user.name, email: user.email });
            setWorkflowCount(wfCount);
            if (count > 0) {
                setRecentWorkflow(workflows[0]);
            }
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };

    useEffect(() => {
        if (session === undefined) return;
        fetchProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, query, status, session]);

    const createProject = async (name: string, description?: string) => {
        const token = localStorage.getItem("token");
        if (!token && status === "unauthenticated") return router.push("/auth");
        if (!token && status === "authenticated") {
            toast.error("You're signed in, but no backend token was found. Please link your account or log in via email/password.");
            return;
        }

        const response = await ProjectsApi.createProject(token ?? "", router, {
            name,
            description,
        });

        if (response?.ok) {
            const created = await response.json();
            const newProject = {
                id: created.id,
                name: created.name,
                lastEdited: formatDate(created.updatedAt || new Date().toISOString()),
                description,
            };

            setProjects((prev) => [newProject, ...prev]);
            setProjectCount(projectCount + 1);
            setPageCache({});
            setPage(1);

            // Create a default workflow for the new project and navigate to canvas
            try {
                const wfRes = await fetch(`${config.backendBaseUrl}/workflow`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        name: `${name} Flow`,
                        projectId: created.id,
                        visualJson: { nodes: [], edges: [] },
                    }),
                });
                if (wfRes?.ok) {
                    const wf = await wfRes.json();
                    const url = `/dominofy/${wf.id}`;
                    router.push(url);
                }
            } catch (e) {
                console.error("Failed to create default workflow:", e);
            }
        } else {
            console.error("Error creating project:", response);
        }
    };

    // Pagination ----------------------------------------------------------
    const handlePrev = () => page > 1 && setPage(page - 1);
    const handleNext = () => page < totalPages && setPage(page + 1);
    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLimit = parseInt(e.target.value);
        setLimit(newLimit);
        setPageCache({});
        setPage(1);
    };

    const handleRedirect = (e: React.MouseEvent) => {
        if (!recentWorkflow?.id) return;
        // Store workflow in sessionStorage
        sessionStorage.setItem("workflow-cache", JSON.stringify(recentWorkflow));

        const url = `/dominofy/${recentWorkflow.id}`;

        // If Cmd/Ctrl/Meta or middle-click → open in new tab
        if (e.metaKey || e.ctrlKey || e.button === 1) {
            window.open(url, "_blank");
        } else {
            router.push(url);
        }
    };

    // Open project's default-or-recent workflow in canvas
    const openProjectEntryWorkflow = async (projectId: string) => {
        try {
            const token = localStorage.getItem("token");
            if (!token && status === "unauthenticated") return router.push("/auth");
            const res = await WorkflowsApi.getEntryWorkflow(projectId, token ?? "", router);
            if (!res?.ok) return;
            const wf = await res.json();
            router.push(`/dominofy/${wf.id}`);
        } catch (err) {
            console.error("Failed to open project entry workflow", err);
        }
    };

    // UI ------------------------------------------------------------------
    return (
        <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-950">
            {(session === undefined || isExchanging) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-dominofy-light-background/60 dark:bg-dominofy-dark-background/60">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                </div>
            )}
            {/* Main column */}
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
                {/* Top cards ----------------------------------------------------*/}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                    {/* Profile Card -------------------------------------------*/}
                    <div className="relative rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md flex flex-col items-center text-center">
                        {/* Credit badge */}
                        <button
                            onClick={() => console.log("Credit clicked")}
                            className="absolute top-4 right-4 flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full shadow hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                $100
                            </span>
                        </button>

                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center">
                                <span className="text-xl font-semibold text-white">
                                    {user.name
                                        .split(" ")
                                        .map((part) => part[0])
                                        .join("")
                                        .toUpperCase()}
                                </span>
                            </div>
                        </div>

                        <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                            {user.name}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>

                        <div className="mt-6 flex space-x-4">
                            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                                <FiUsers className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    11
                                </span>
                            </div>
                            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                                <FiCheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    56
                                </span>
                            </div>
                            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                                <FiAward className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    12
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Card -------------------------------------------*/}
                    <div className="relative rounded-2xl bg-white dark:bg-gray-800 shadow-md overflow-hidden h-full">
                        {/* Header overlay - Top left */}
                        <div className="absolute top-0 left-0 flex items-center px-2 py-2 z-10">
                            <div className="rounded-full px-4 py-2 bg-gray-400/30 dark:bg-black/30 backdrop-blur-sm flex items-center gap-x-2 text-black dark:text-white">
                                <FiClock className="w-5 h-5" />
                                <p className="text-sm font-medium">
                                    {(recentWorkflow?.isDefault && recentWorkflow.createdAt === recentWorkflow.updatedAt) ? 'Default' : 'Recent'}
                                </p>
                            </div>
                        </div>

                        {/* Redirect icon - Top right */}
                        <div className="absolute top-0 right-0 px-3 py-2 z-10">
                            <button
                                onClick={handleRedirect}
                                className="rounded-full p-2 bg-gray-400/30 dark:bg-black/30 backdrop-blur-sm text-black dark:text-white hover:bg-gray-500/40 dark:hover:bg-white/20 transition"
                                title="Open full view"
                            >
                                <FiExternalLink className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Canvas */}
                        <div className="h-full">
                            <Canvas
                                nodes={recentWorkflow?.visualJson?.nodes ?? []}
                                edges={recentWorkflow?.visualJson?.edges ?? []}
                                setNodes={setNodes}
                                setEdges={setEdges}
                                id='dashboard-recent'
                                readonly={true}
                            />
                        </div>
                    </div>


                    {/* Additional Tasks Card --------------------------------*/}
                    <div className="rounded-2xl bg-gradient-to-br from-cyan-200 via-blue-200 to-blue-100 dark:from-cyan-800 dark:via-blue-800 dark:to-blue-700 p-6 shadow-md flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Additional tasks
                            </p>
                            <div className="bg-white/30 dark:bg-white/20 p-2 rounded-full">
                                <FiCheck className="w-5 h-5 text-gray-800 dark:text-gray-100" />
                            </div>
                        </div>
                        <div className="mt-6">
                            <p className="text-4xl font-bold text-gray-900 dark:text-white">56%</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Avg. completed</p>
                        </div>
                    </div>

                    {/* Stats Row -------------------------------------------*/}
                    <div className="col-span-1 sm:col-span-3 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md">
                        <div className="grid grid-cols-3 text-center gap-4">
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Success Rate
                                </p>
                                <p className="text-lg font-bold text-green-600">98%</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Last 24 h</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Errors
                                </p>
                                <p className="text-lg font-bold text-red-600">2</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Last 24 h</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Avg. Runtime
                                </p>
                                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    2.3 s
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Per task</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle section -------------------------------------------*/}
                <div className="flex flex-1 gap-4">
                    {/* Templates Canvas ----------------------------------*/}
                    <TemplatesCanvas templates={templates} />

                    {/* Insights Panel ------------------------------------*/}
                    <div className="w-[35%] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md bg-white dark:bg-gray-800 flex items-center justify-center p-6">
                        <DashboardInsightsPanel
                            projectCount={projectCount}
                            workflowCount={workflowCount}
                        />
                    </div>
                </div>
            </div>

            {/* Sidebar ---------------------------------------------------------*/}
            <aside className="w-[352px] border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col">
                {/* Search */}
                <div className="flex items-center gap-3 p-4">
                    <div className="flex items-center flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-2">
                        <FiSearch className="text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search projects…"
                            className="bg-transparent flex-1 text-sm focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            value={query}
                            onChange={(e) => {
                                const value = e.target.value;
                                setQuery(value);
                                setPageCache({});
                                setPage(1);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") setPage(1);
                            }}
                        />
                    </div>
                    <button
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <FiPlus className="w-4 h-4" />
                    </button>
                </div>
                <hr className="border-t border-gray-200 dark:border-gray-800 w-full" />

                {/* Project list */}
                <div className="flex-1 overflow-y-auto">
                    <h3 className="px-4 pt-2 pb-1 text-sm font-semibold text-gray-600 dark:text-gray-300">Projects</h3>
                    {projects.length > 0 ? (
                        <ul className="space-y-1 px-2">
                            {projects.map((project) => (
                                <li
                                    key={project.id}
                                    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group"
                                    onClick={() => openProjectEntryWorkflow(project.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-dominofy-primary">
                                            {project.name}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                            {project.description ?? project.lastEdited}
                                        </p>
                                    </div>
                                    <FiChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-dominofy-primary" />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-4 space-y-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">No projects to show.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 sticky bottom-0 z-10 flex justify-center items-center gap-4">
                    <button
                        onClick={handlePrev}
                        disabled={page === 1}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm ${page === 1
                            ? "text-gray-300 border-gray-200 dark:border-gray-800"
                            : "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900"
                            }`}
                    >
                        &lt;
                    </button>

                    <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[60px] text-center">
                        <strong>{page}</strong> / {totalPages}
                    </span>

                    <button
                        onClick={handleNext}
                        disabled={page === totalPages}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm ${page === totalPages
                            ? "text-gray-300 border-gray-200 dark:border-gray-800"
                            : "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900"
                            }`}
                    >
                        &gt;
                    </button>

                    <div className="ml-2 flex items-center text-sm text-gray-600 dark:text-gray-400 gap-1">
                        <select
                            value={limit}
                            onChange={handleLimitChange}
                            className="px-3 py-1 rounded-full border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-sm focus:outline-none"
                        >
                            {[5, 10, 20, 50].map((val) => (
                                <option key={val} value={val} className="bg-white dark:bg-gray-800">
                                    {val}
                                </option>
                            ))}
                        </select>
                        <span className="text-sm">/Page</span>
                    </div>
                </div>
            </aside>

            {/* Toast -----------------------------------------------------------*/}
            <ToastContainer position="top-right" autoClose={5000} hideProgressBar />

            {/* Modal -----------------------------------------------------------*/}
            <CreateProjectModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={createProject}
            />
        </div>
    );
}