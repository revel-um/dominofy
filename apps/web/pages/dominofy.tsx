'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DominofyLayout from "./dominofy/[id]";
import { ProjectsApi } from "../apis/projects.apis";
import { WorkflowsApi } from "../apis/workflow.apis";
import { TokenManager } from "../utils/auth";

export default function Dominofy() {
  const router = useRouter();
  const [currWorkflow, setCurrWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { projectId, workflowId } = router.query;
    
    if (!router.isReady) return;
    
    const loadWorkflow = async () => {
      try {
        setLoading(true);
        
        const token = await TokenManager.getValidAccessToken();
        if (!token) {
          router.push('/auth');
          return;
        }

        let workflowData = null;
        const resolveWorkflowFromProject = async () => {
          if (!projectId) return null;

          const projectResponse = await ProjectsApi.getProjectDetailsWithWorkflows(
            projectId as string,
            token,
            router
          );

          if (!projectResponse?.ok) {
            const status = projectResponse?.status ?? 'unknown';
            throw new Error(`Failed to load project (${status})`);
          }

          const data = await projectResponse.json();
          const workflows = Array.isArray(data?.workflows) ? data.workflows : [];

          if (!workflowId) {
            return workflows[0] ?? null;
          }

          return (
            workflows.find((candidate: { id: string }) => candidate.id === workflowId) ??
            workflows[0] ??
            null
          );
        };

        if (workflowId) {
          // If workflowId is provided, load that specific workflow
          const response = await WorkflowsApi.getWorkflowById(workflowId as string, token, router);
          if (response?.ok) {
            workflowData = await response.json();
          } else if (response?.status === 404) {
            workflowData = await resolveWorkflowFromProject();
            if (!workflowData) {
              router.push('/dashboard');
              return;
            }
          } else {
            const status = response?.status ?? 'unknown';
            console.error('Failed to load workflow directly', {
              workflowId,
              projectId,
              status,
            });
            workflowData = await resolveWorkflowFromProject();
            if (!workflowData) {
              throw new Error(`Failed to load workflow (${status})`);
            }
          }
        } else if (projectId) {
          // If only projectId is provided, get project details and use first workflow
          workflowData = await resolveWorkflowFromProject();
        } else {
          // No valid parameters provided
          router.push('/dashboard');
          return;
        }

        setCurrWorkflow(workflowData);
      } catch (err: any) {
        console.error('Error loading workflow:', err);
        setCurrWorkflow(null);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();
  }, [router.isReady, router.query.projectId, router.query.workflowId]);

  if (!router.isReady || loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-xl">
        Loading workflow...
      </div>
    );
  }

  if (!currWorkflow && !router.query.projectId) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-xl">
        No workflow found
      </div>
    );
  }

  return <DominofyLayout currWorkflow={currWorkflow} />;
}
