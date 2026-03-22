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
  const [error, setError] = useState(null);

  useEffect(() => {
    const { projectId, workflowId } = router.query;
    
    if (!router.isReady) return;
    
    const loadWorkflow = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = await TokenManager.getValidAccessToken();
        if (!token) {
          router.push('/auth');
          return;
        }

        let workflowData = null;

        if (workflowId) {
          // If workflowId is provided, load that specific workflow
          const response = await WorkflowsApi.getWorkflowById(workflowId as string, token, router);
          if (response?.ok) {
            workflowData = await response.json();
          } else {
            throw new Error('Failed to load workflow');
          }
        } else if (projectId) {
          // If only projectId is provided, get project details and use first workflow
          const response = await ProjectsApi.getProjectDetailsWithWorkflows(projectId as string, token, router);
          if (response?.ok) {
            const data = await response.json();
            const { workflows } = data;
            if (workflows && workflows.length > 0) {
              workflowData = workflows[0];
            } else {
              throw new Error('No workflows found for project');
            }
          } else {
            throw new Error('Failed to load project');
          }
        } else {
          // No valid parameters provided
          router.push('/dashboard');
          return;
        }

        setCurrWorkflow(workflowData);
      } catch (err: any) {
        console.error('Error loading workflow:', err);
        setError(err.message);
        // Optionally redirect to error page or dashboard
        // router.push('/error');
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

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-xl text-red-500">
        Error: {error}
      </div>
    );
  }

  if (!currWorkflow) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-xl">
        No workflow found
      </div>
    );
  }

  return <DominofyLayout currWorkflow={currWorkflow} />;
}
