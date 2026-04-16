import React, { useEffect, useState } from "react";
import Canvas from "../components/canvas";
import { ProjectsApi } from "../apis/projects.apis";
import { toast } from "react-toastify";
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
    FiX,
} from "react-icons/fi";
import TemplatesCanvas from "../components/templateCarousel";
import { useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import { TokenManager } from "../utils/auth";
import { resumeScoringTemplate } from "../templates/resumeScoringTemplate";
import { WorkspaceApi, WorkspaceSummary } from "../apis/workspace.apis";
import { getActiveWorkspaceIdFromStorage, setActiveWorkspaceIdInStorage } from "../utils/workspace";

const CANVAS_MODE_STORAGE_KEY_PREFIX = "dominofy-canvas-mode";

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
    visualJson: { nodes: Node[]; edges: Edge[] };
    createdAt: Date;
    updatedAt: Date;
    project?: {
        id: string;
        name: string;
        description?: string;
    };
}

interface WorkflowWithCache extends Workflow {
    isCached?: boolean;
}

interface User {
    name: string;
    email: string;
}

interface ProjectListItem {
    id: string;
    name: string;
    updatedAt: string;
    description?: string;
}

interface TemplatePreview {
    nodes: Node[];
    edges: Edge[];
}

interface DashboardMetricsSummary {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    runningExecutions: number;
    recentExecutions: number;
    last7DayErrors: number;
    deployedWorkflowCount: number;
}

export default function DominofyDashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [pageCache, setPageCache] = useState<Record<string, Project[]>>({});
    const [query, setQuery] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [recentWorkflow, setRecentWorkflow] = useState<WorkflowWithCache>();
    const [projectCount, setProjectCount] = useState(0);
    const [workflowCount, setWorkflowCount] = useState(0);
    const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricsSummary>({
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        runningExecutions: 0,
        recentExecutions: 0,
        last7DayErrors: 0,
        deployedWorkflowCount: 0,
    });
    const [user, setUser] = useState<User>({ name: "", email: "" });
    const [templates, setTemplates] = useState<TemplatePreview[]>([]);
    const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
    const [isExchanging, setIsExchanging] = useState(false);
    const [booting, setBooting] = useState(true);
    const [lastActiveWorkflowId, setLastActiveWorkflowId] = useState<string | null>(null);
    const [recentWorkflowExpanded, setRecentWorkflowExpanded] = useState(true);

    const [, setNodes] = useNodesState([]);
    const [, setEdges] = useEdgesState([]);

    const router = useRouter();
    const { status, data: session } = useSession();

    useEffect(() => {
        if (status === "loading") return;

        let active = true;

        const bootstrapAuth = async () => {
            const token = await TokenManager.getValidAccessToken();
            if (!active) return;

            const storedActive = typeof window !== "undefined" ? localStorage.getItem("dominofy-last-active-tab") : null;
            setLastActiveWorkflowId(storedActive || null);

            if (!token && status === "unauthenticated") {
                router.replace("/auth");
                return;
            }

            setBooting(false);
        };

        bootstrapAuth();

        return () => {
            active = false;
        };
    }, [status, router]);


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

    // Helper function to merge cached workflow data with database workflow
    const mergeCachedWorkflow = (workflow?: Workflow | null): WorkflowWithCache | undefined => {
        if (!workflow) {
            return undefined;
        }
        const cachedWorkflowData = sessionStorage.getItem(`workflow-${workflow.id}`);
        
        if (cachedWorkflowData) {
            try {
                const cached = JSON.parse(cachedWorkflowData);
                if (cached?.dirty === false) {
                    return workflow;
                }
                if (cached?.nodes && cached?.edges) {
                    return {
                        ...workflow,
                        visualJson: {
                            nodes: cached.nodes || workflow.visualJson.nodes,
                            edges: cached.edges || workflow.visualJson.edges
                        },
                        isCached: true
                    };
                }
            } catch (error) {
                console.error('Error parsing cached workflow data:', error);
                return workflow;
            }
        }
        
        return workflow;
    };

    const getStoredCanvasMode = (workflowId?: string | null) => {
        if (typeof window === "undefined" || !workflowId) return true;
        try {
            const stored = localStorage.getItem(`${CANVAS_MODE_STORAGE_KEY_PREFIX}:${workflowId}`);
            if (stored === null) return true;
            return stored === "expanded";
        } catch {
            return true;
        }
    };

    useEffect(() => {
        setRecentWorkflowExpanded(getStoredCanvasMode(recentWorkflow?.id));
    }, [recentWorkflow?.id]);

    // Data ----------------------------------------------------------------
    const fetchProjects = async () => {
        // Wait until NextAuth resolves the session (undefined means pending in v5)
        if (booting || session === undefined) return;
        let currentToken = await TokenManager.getValidAccessToken();
        // If user is unauthenticated via NextAuth and also no backend token, redirect to /auth
        if (!currentToken && status === "unauthenticated") return router.replace("/auth");
        // If authenticated via NextAuth but backend token is missing, try exchanging for a backend token
        if (!currentToken && status === "authenticated") {
            setIsExchanging(true);
            try {
                const resp = await fetch('/api/auth/exchange', { method: 'POST' });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.accessToken && data?.refreshToken) {
                        TokenManager.setTokens(data.accessToken, data.refreshToken);
                        currentToken = data.accessToken;
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
        if (!currentToken && status === "authenticated") {
            if (session?.user) {
                setUser({ name: session.user.name || "", email: session.user.email || "" });
            }
            return; // Skip backend fetches gracefully
        }

        const requestedWorkspaceId =
            (typeof router.query.workspaceId === "string" ? router.query.workspaceId : null) ||
            getActiveWorkspaceIdFromStorage() ||
            undefined;
        const offset = (page - 1) * limit;
        const cacheKey = `${requestedWorkspaceId || "default"}-${page}-${limit}-${query}`;

        try {
            const workspaceResponse = await WorkspaceApi.getCurrentWorkspaceSummary(
                currentToken ?? "",
                router,
                requestedWorkspaceId,
            );
            if (workspaceResponse?.ok) {
                const workspace = await workspaceResponse.json() as WorkspaceSummary;
                setWorkspaceSummary(workspace);
                setActiveWorkspaceIdInStorage(workspace.id);
            }

            if (pageCache[cacheKey]) {
                setProjects(pageCache[cacheKey]);
            }

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
                },
                resumeScoringTemplate
            ])
            if (!pageCache[cacheKey]) {
                const response = await ProjectsApi.getProjects(
                    currentToken ?? "",
                    router,
                    limit,
                    offset,
                    query,
                    requestedWorkspaceId,
                );
                if (!response?.ok) return;

                const { data, count } = await response.json() as { data: ProjectListItem[]; count: number };
                const formatted = data.map((p) => ({
                    id: p.id,
                    name: p.name,
                    lastEdited: formatDate(p.updatedAt),
                    description: p.description,
                }));

                setProjects(formatted);
                setProjectCount(count);
                setPageCache((prev) => ({ ...prev, [cacheKey]: formatted }));
                setTotalPages(Math.max(1, Math.ceil(count / limit)));
            }

            const workflowResponse = await WorkflowsApi.getRecentWorkflowsAndCount(
                currentToken ?? "",
                router,
                undefined,
                requestedWorkspaceId,
            );
            if (!workflowResponse?.ok) return;

            const { workflows, count: wfCount, user } = await workflowResponse.json() as {
                workflows: Workflow[];
                count: number;
                user: User;
            };
            setUser({ name: user.name, email: user.email });
            setWorkflowCount(wfCount);

            const performanceResponse = await WorkflowsApi.getWorkspacePerformanceMetrics(
                currentToken ?? "",
                router,
                {
                    workspaceId: requestedWorkspaceId,
                    workflowLimit: 1,
                    workflowOffset: 0,
                    errorLimit: 1,
                    errorOffset: 0,
                },
            );

            if (performanceResponse?.ok) {
                const { summary } = await performanceResponse.json() as {
                    summary: {
                        totalExecutions: number;
                        successfulExecutions: number;
                        failedExecutions: number;
                        runningExecutions: number;
                        recentExecutions: number;
                        last7DayErrors: number;
                        totalWorkflows: number;
                    };
                };

                setDashboardMetrics({
                    totalExecutions: summary.totalExecutions ?? 0,
                    successfulExecutions: summary.successfulExecutions ?? 0,
                    failedExecutions: summary.failedExecutions ?? 0,
                    runningExecutions: summary.runningExecutions ?? 0,
                    recentExecutions: summary.recentExecutions ?? 0,
                    last7DayErrors: summary.last7DayErrors ?? 0,
                    deployedWorkflowCount: summary.totalWorkflows ?? 0,
                });
            } else {
                setDashboardMetrics({
                    totalExecutions: 0,
                    successfulExecutions: 0,
                    failedExecutions: 0,
                    runningExecutions: 0,
                    recentExecutions: 0,
                    last7DayErrors: 0,
                    deployedWorkflowCount: 0,
                });
            }

            if (wfCount > 0) {
                const preferred = workflows.find((w) => w.id === lastActiveWorkflowId) || workflows[0];
                const recentWorkflowWithCache = mergeCachedWorkflow(preferred);
                setRecentWorkflow(recentWorkflowWithCache);
            } else {
                setRecentWorkflow(undefined);
            }
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };

    useEffect(() => {
        setPageCache({});
        setPage(1);
    }, [router.query.workspaceId]);

    useEffect(() => {
        if (booting || session === undefined) return;
        fetchProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, query, status, session, booting, lastActiveWorkflowId, router.query.workspaceId]);

    const createProject = async (name: string, description?: string) => {
        const token = await TokenManager.getValidAccessToken();
        if (!token && status === "unauthenticated") return router.push("/auth");
        if (!token && status === "authenticated") {
            toast.error("You're signed in, but no backend token was found. Please link your account or log in via email/password.");
            return;
        }

        const response = await ProjectsApi.createProject(token ?? "", router, {
            name,
            description,
            workspaceId: workspaceSummary?.id,
        });

        if (response?.ok) {
            const result = await response.json();
            // Handle new API response structure that returns { project, defaultWorkflow }
            const created = result.project || result;
            const newProject = {
                id: created.id,
                name: created.name,
                lastEdited: formatDate(created.updatedAt || new Date().toISOString()),
                description,
            };

            setProjects((prev) => [newProject, ...prev]);
            setProjectCount(projectCount + 1);
            // Since we create a default workflow with each project, increment workflow count
            if (result.defaultWorkflow) {
                setWorkflowCount(workflowCount + 1);
            }
            setPageCache({});
            setPage(1);

            if (created?.id) {
                router.push(`/dominofy?projectId=${created.id}`);
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

        const url = `/dominofy?projectId=${recentWorkflow.project!.id}&workflowId=${recentWorkflow.id}`;

        // If Cmd/Ctrl/Meta or middle-click → open in new tab
        if (e.metaKey || e.ctrlKey || e.button === 1) {
            window.open(url, "_blank");
        } else {
            router.push(url);
        }
    };

    // Open project in dominofy layout with type parameter
    const openProjectEntryWorkflow = (projectId: string) => {
        router.push(`/dominofy?projectId=${projectId}`);
    };

    // UI ------------------------------------------------------------------
    const firstName = user.name?.split(" ")[0] || "there";
    const recentWorkflowLabel = recentWorkflow
        ? recentWorkflow.name
        : "No workflow selected yet";
    const recentWorkflowMeta = recentWorkflow?.updatedAt
        ? `Updated ${formatDate(String(recentWorkflow.updatedAt))}`
        : "Pick a project to jump into your latest automation";
    const workspaceName = workspaceSummary?.name || "Workspace";
    const workspaceRole = workspaceSummary?.role ?? "member";
    const successRateValue = dashboardMetrics.totalExecutions > 0
        ? (dashboardMetrics.successfulExecutions / dashboardMetrics.totalExecutions) * 100
        : 0;
    const successRate = `${Math.max(0, Math.min(100, Math.round(successRateValue)))}%`;
    const draftCount = Math.max(0, workflowCount - dashboardMetrics.deployedWorkflowCount);
    const activeCollaborators = workspaceSummary?.memberCount ?? 0;

    const showBlockingLoader = booting || status === "loading" || isExchanging;
    if (showBlockingLoader) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-dominofy-light-background dark:bg-dominofy-dark-background">
                <div className="flex items-center gap-3 text-dominofy-light-text dark:text-dominofy-dark-text">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-dominofy-light-accent border-t-transparent" />
                    <span className="text-sm font-medium">Loading your workspace…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_46%,#f8fafc_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_44%,#111827_100%)] dark:text-slate-100 xl:h-screen xl:overflow-hidden">
            {(session === undefined || isExchanging) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-dominofy-light-background/60 dark:bg-dominofy-dark-background/60">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.16),_transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_28%)]" />
            <div className="relative flex-1 overflow-visible p-4 sm:p-5 xl:overflow-hidden">
                <div className="flex flex-col gap-5 xl:h-full xl:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-5 xl:h-full xl:overflow-y-auto xl:pr-1">
                        <section className="grid shrink-0 grid-cols-1 items-start gap-5 xl:grid-cols-[1.25fr_1.6fr] xl:items-stretch">
                            <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(145deg,_rgba(255,255,255,0.98),_rgba(240,249,255,0.94))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_34%),linear-gradient(145deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.84))] xl:h-full">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_28%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_28%)]" />
                                <div className="relative flex h-full flex-col justify-between gap-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300 sm:text-xs sm:tracking-[0.24em]">
                                                Dashboard overview
                                            </p>
                                            <h1 className="mt-3 max-w-lg text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">
                                                Welcome back, {firstName}.
                                            </h1>
                                            <p className="mt-3 max-w-xl text-[13px] leading-5 text-slate-600 dark:text-slate-300 sm:text-sm sm:leading-6">
                                                Your automation workspace is organized around current flow activity, reusable templates, and the fastest route back into production work.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 xl:grid-cols-2 min-[1850px]:grid-cols-4">
                                        <div className="rounded-[24px] border border-white/70 bg-white/80 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-4">
                                            <div className="flex min-w-0 items-start gap-3 text-slate-500 dark:text-slate-300">
                                                <FiUsers className="mt-0.5 h-4 w-4 shrink-0" />
                                                <span className="min-w-0 break-words text-[9px] font-semibold uppercase leading-3 tracking-[0.06em] sm:text-[10px] sm:leading-4 sm:tracking-[0.1em]">Collaborators</span>
                                            </div>
                                            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">
                                                {activeCollaborators}
                                            </p>
                                            <p className="mt-1 break-words text-[13px] leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">Active inside {workspaceName}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    workspaceSummary?.id
                                                        ? `/performance?workspaceId=${workspaceSummary.id}&tab=execution`
                                                        : "/performance?tab=execution"
                                                )
                                            }
                                            className="rounded-[24px] border border-white/70 bg-white/80 p-3 text-left backdrop-blur-sm transition hover:border-emerald-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-900/40 dark:hover:bg-white/[0.07] sm:p-4"
                                        >
                                            <div className="flex min-w-0 items-start gap-3 text-slate-500 dark:text-slate-300">
                                                <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                                <span className="min-w-0 break-words text-[9px] font-semibold uppercase leading-3 tracking-[0.06em] sm:text-[10px] sm:leading-4 sm:tracking-[0.1em]">Success rate</span>
                                            </div>
                                            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">{successRate}</p>
                                            <p className="mt-1 break-words text-[13px] leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                                                {dashboardMetrics.totalExecutions} tracked execution{dashboardMetrics.totalExecutions === 1 ? "" : "s"}
                                            </p>
                                        </button>
                                        <div className="rounded-[24px] border border-white/70 bg-white/80 p-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-4">
                                            <div className="flex min-w-0 items-start gap-3 text-slate-500 dark:text-slate-300">
                                                <FiAward className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                                <span className="min-w-0 break-words text-[9px] font-semibold uppercase leading-3 tracking-[0.06em] sm:text-[10px] sm:leading-4 sm:tracking-[0.1em]">Role</span>
                                            </div>
                                            <p className="mt-2 text-xl font-semibold capitalize text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">
                                                {workspaceRole}
                                            </p>
                                            <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">Permissions inside this workspace</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(
                                                    workspaceSummary?.id
                                                        ? `/performance?workspaceId=${workspaceSummary.id}&tab=errors`
                                                        : "/performance?tab=errors"
                                                )
                                            }
                                            className="rounded-[24px] border border-white/70 bg-white/80 p-3 text-left backdrop-blur-sm transition hover:border-rose-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-rose-900/40 dark:hover:bg-white/[0.07] sm:p-4"
                                        >
                                            <div className="flex min-w-0 items-start gap-3 text-slate-500 dark:text-slate-300">
                                                <FiX className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                                <span className="min-w-0 break-words text-[9px] font-semibold uppercase leading-3 tracking-[0.06em] sm:text-[10px] sm:leading-4 sm:tracking-[0.1em]">Errors last 7d</span>
                                            </div>
                                            <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white sm:mt-3 sm:text-2xl">
                                                {dashboardMetrics.last7DayErrors}
                                            </p>
                                            <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">Failed executions in the last 7 days</p>
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-2 text-[13px] text-slate-700 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200 sm:px-4 sm:text-sm">
                                            <FiCheck className="h-4 w-4 text-emerald-500" />
                                            {projectCount} project{projectCount === 1 ? "" : "s"} in motion
                                        </div>
                                        <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-2 text-[13px] text-slate-700 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200 sm:px-4 sm:text-sm">
                                            <FiClock className="h-4 w-4 text-sky-500" />
                                            {draftCount} draft workflow{draftCount === 1 ? "" : "s"} ready for refinement
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid items-start gap-4 xl:h-full xl:grid-rows-[65fr_35fr]">
                                <div className="relative h-[260px] overflow-hidden rounded-[32px] border border-white/70 bg-white/70 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/55 sm:h-[280px] xl:h-full xl:min-h-0">
                                    {recentWorkflow?.id ? (
                                        <>
                                            <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-5">
                                                <div className="max-w-[70%] rounded-[22px] border border-white/60 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/55">
                                                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300">
                                                        <FiClock className="h-4 w-4" />
                                                        <p className="text-xs font-semibold uppercase tracking-[0.24em]">
                                                            {(recentWorkflow.isDefault && recentWorkflow.createdAt === recentWorkflow.updatedAt) ? "Default flow" : "Recent workflow"}
                                                        </p>
                                                    </div>
                                                    <p className="mt-2 truncate text-base font-semibold text-slate-950 dark:text-white">
                                                        {recentWorkflowLabel}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                                        {recentWorkflowMeta}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleRedirect}
                                                    className="rounded-full border border-white/60 bg-white/75 p-3 text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-slate-950/55 dark:text-white dark:hover:bg-slate-900"
                                                    title="Open full view"
                                                >
                                                    <FiExternalLink className="h-5 w-5" />
                                                </button>
                                            </div>

                                            <div className="h-full">
                                                <Canvas
                                                    nodes={recentWorkflow.visualJson?.nodes ?? []}
                                                    edges={recentWorkflow.visualJson?.edges ?? []}
                                                    setNodes={setNodes}
                                                    setEdges={setEdges}
                                                    id='dashboard-recent'
                                                    readonly={true}
                                                    isExpandedMode={recentWorkflowExpanded}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(true)}
                                            className="group flex h-full w-full items-center justify-center p-6 text-center transition"
                                        >
                                            <div className="flex w-full max-w-md flex-col items-center justify-center px-8 py-10">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 transition group-hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:group-hover:bg-sky-500/20">
                                                    <FiPlus className="h-6 w-6" />
                                                </div>
                                                <p className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">
                                                    Create a new project
                                                </p>
                                                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                    This workspace does not have a recent workflow yet. Start by creating a project, and the default workflow will appear here automatically.
                                                </p>
                                            </div>
                                        </button>
                                    )}
                                </div>

                                <div className="rounded-[32px] border border-white/70 bg-[linear-gradient(155deg,_rgba(14,165,233,0.18),_rgba(59,130,246,0.1)_45%,_rgba(255,255,255,0.92)_100%)] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[linear-gradient(155deg,_rgba(14,165,233,0.24),_rgba(59,130,246,0.16)_45%,_rgba(15,23,42,0.92)_100%)] xl:h-full">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                                                Current workspace
                                            </p>
                                            <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white break-words">
                                                {workspaceName}
                                            </h2>
                                        </div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-slate-900 dark:bg-white/10 dark:text-white">
                                            <FiUsers className="h-5 w-5" />
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3">
                                        <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                                                Projects
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                                                {workspaceSummary?.projectCount ?? 0}
                                            </p>
                                        </div>
                                        <div className="rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                                                Members
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                                                {workspaceSummary?.memberCount ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/workspaces")}
                                        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-sky-400/50 dark:hover:text-sky-300"
                                    >
                                        Manage workspace
                                    </button>
                                </div>
                            </div>
                        </section>

                        <section className="grid min-h-0 gap-5 2xl:grid-cols-[1.45fr_0.95fr]">
                            <div className="min-h-[420px] 2xl:min-h-[460px]">
                                <TemplatesCanvas templates={templates} />
                            </div>

                            <div className="rounded-[32px] border border-white/70 bg-white/70 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/55">
                                <DashboardInsightsPanel
                                    projectCount={projectCount}
                                    workflowCount={workflowCount}
                                    deployedCount={dashboardMetrics.deployedWorkflowCount}
                                    totalExecutions={dashboardMetrics.totalExecutions}
                                    recentExecutions={dashboardMetrics.recentExecutions}
                                    failedExecutions={dashboardMetrics.failedExecutions}
                                    runningExecutions={dashboardMetrics.runningExecutions}
                                    successRate={successRateValue}
                                />
                            </div>
                        </section>
                    </div>
                    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[32px] border border-white/70 bg-white/70 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/55 xl:h-full xl:max-w-[360px]">
                        <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                                        Project control
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                                        Your projects
                                    </h2>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                        Search, create, and jump into the entry workflow for any project.
                                    </p>
                                </div>
                                <button
                                    className="aspect-square flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                                    onClick={() => setIsModalOpen(true)}
                                    aria-label="Create project"
                                >
                                    <FiPlus className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-5 flex items-center gap-3 rounded-[22px] border border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                                <FiSearch className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search projects…"
                                    className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                            {projects.length > 0 ? (
                                <ul className="space-y-2">
                                    {projects.map((project) => (
                                        <li key={project.id}>
                                            <button
                                                type="button"
                                                className="group flex w-full items-center justify-between rounded-[24px] border border-transparent bg-white/75 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white dark:bg-white/5 dark:hover:border-sky-400/20 dark:hover:bg-white/10"
                                                onClick={() => openProjectEntryWorkflow(project.id)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-slate-950 transition group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-200">
                                                        {project.name}
                                                    </p>
                                                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                                        {project.description ?? project.lastEdited}
                                                    </p>
                                                </div>
                                                <div className="ml-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition group-hover:bg-sky-100 group-hover:text-sky-700 dark:bg-white/10 dark:text-slate-500 dark:group-hover:bg-sky-400/10 dark:group-hover:text-sky-200">
                                                    <FiChevronRight className="h-4 w-4" />
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                                        <FiSearch className="h-6 w-6" />
                                    </div>
                                    <p className="mt-4 text-base font-medium text-slate-900 dark:text-white">No projects found</p>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        Refine the search or create a new project from this panel.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200/70 px-5 py-4 dark:border-white/10">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrev}
                                        disabled={page === 1}
                                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-sky-400/20 dark:hover:bg-sky-400/10"
                                    >
                                        &lt;
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={page === totalPages}
                                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-sky-400/20 dark:hover:bg-sky-400/10"
                                    >
                                        &gt;
                                    </button>
                                </div>

                                <span className="min-w-[72px] text-center text-sm text-slate-600 dark:text-slate-300">
                                    <strong>{page}</strong> / {totalPages}
                                </span>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={limit}
                                        onChange={handleLimitChange}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                                    >
                                        {[5, 10, 20, 50].map((val) => (
                                            <option key={val} value={val} className="bg-white dark:bg-slate-900">
                                                {val}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">/ page</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Modal -----------------------------------------------------------*/}
            <CreateProjectModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={createProject}
            />
        </div>
    );
}
