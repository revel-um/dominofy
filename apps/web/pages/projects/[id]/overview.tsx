import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ToastContainer, toast } from "react-toastify";
import { ProjectsApi } from "../../../apis/projects.apis";
import { WorkflowsApi } from "../../../apis/workflow.apis";

interface OverviewResponse {
  project: { id: string; name: string; description?: string; createdAt: string; updatedAt: string; isActive: boolean };
  counts: { workflowCount: number; publishedCount: number };
  recentWorkflows: Array<{ id: string; name: string; updatedAt: string; isPublished: boolean; isDefault: boolean }>;
}

export default function ProjectOverviewPage() {
  const router = useRouter();
  const rawId = (router.query as any)?.id as string | string[] | undefined;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { status } = useSession();

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const fetchOverview = async () => {
      try {
        let token = localStorage.getItem("token");
        if (!token && status === "unauthenticated") return router.push("/auth");
        if (!token && status === "authenticated") {
          try {
            const resp = await fetch('/api/auth/exchange', { method: 'POST' });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.token) {
                localStorage.setItem('token', data.token);
                token = data.token;
              } else {
                toast.error('Token exchange failed: no token returned');
                setLoading(false);
                return;
              }
            } else {
              const text = await resp.text();
              console.error('Exchange failed:', text);
              toast.error('Token exchange failed');
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Exchange error:', e);
            toast.error('Token exchange error');
            setLoading(false);
            return;
          }
        }
        const res = await ProjectsApi.getProjectOverview(token ?? "", router, id);
        if (!res?.ok) return;
        const data = await res.json();
        setOverview(data);
        setRecentWorkflows(data.recentWorkflows || []);
        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load project overview");
        setLoading(false);
      }
    };
    fetchOverview();
  }, [id, status]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!overview) {
    return <div className="p-6">No overview data found.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {overview.project ? 'Project' : 'Overview'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {overview.project ? overview.project.name : 'Your account overview'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Workflows</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.counts.workflowCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Published</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{overview.counts.publishedCount}</p>
        </div>
        {typeof (overview as any).counts.projectCount === 'number' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Projects</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(overview as any).counts.projectCount}</p>
          </div>
        )}
      </div>

      {/* Recent Workflows List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Workflows</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentWorkflows.length === 0 && (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No workflows yet.</div>
          )}
          {recentWorkflows.map((wf) => (
            <div key={wf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex items-center gap-3">
                <div className="font-medium text-gray-900 dark:text-gray-100">{wf.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Updated {new Date(wf.updatedAt).toLocaleString()}</div>
                {wf.isDefault && <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">Default</span>}
                {wf.isPublished ? (
                  <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-xs">Published</span>
                ) : (
                  <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 text-xs">Draft</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/dominofy/${wf.id}`)}
                  className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Open in Canvas
                </button>
                <button
                  onClick={async () => {
                    const newName = prompt("Rename workflow", wf.name);
                    if (!newName || newName.trim() === wf.name) return;
                    try {
                      const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
                      if (!token && status === "unauthenticated") return router.push("/auth");
                      const resp = await WorkflowsApi.renameWorkflow(wf.id, newName.trim(), token ?? "", router);
                      if (resp?.ok) {
                        setRecentWorkflows((prev) => prev.map(x => x.id === wf.id ? { ...x, name: newName.trim() } : x));
                        toast.success("Workflow renamed");
                      }
                    } catch (e) {
                      console.error(e);
                      toast.error("Rename failed");
                    }
                  }}
                  className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Rename
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
