import React, { useState } from "react";
import { FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown } from "react-icons/fi";

type SortField = 'name' | 'workflowCount' | 'scheduledCount' | 'deployedCount' | 'description' | 'projectName' | 'isPublished';
type SortDirection = 'asc' | 'desc';

interface Workflow {
  id: string;
  name: string;
  projectName: string;
  visualJson: { nodes: any[]; edges: any[] };
  isPublished: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string;
  workflowCount: number;
  scheduledCount: number;
  deployedCount: number;
}

const mockProjects: Project[] = [
  { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
  { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
];

const mockWorkflows: Workflow[] = [
  { id: "w1", name: "Weekly Campaign", projectName: "Marketing Automation", visualJson: { nodes: [], edges: [] }, isPublished: true },
  { id: "w2", name: "New User Onboarding", projectName: "Marketing Automation", visualJson: { nodes: [], edges: [] }, isPublished: false },
  { id: "w3", name: "Lead Sync", projectName: "Salesforce Sync", visualJson: { nodes: [], edges: [] }, isPublished: true },
];

function getPaginationRange(current: number, total: number, siblingCount = 1): (number | "ellipsis")[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblingCount, 2);
  const right = Math.min(current + siblingCount, total - 1);

  const range: (number | "ellipsis")[] = [1];
  if (left > 2) range.push("ellipsis");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("ellipsis");
  range.push(total);
  return range;
}

const ROW_H = "calc(100% / 10)";

function SortIndicator({ field, currentField, direction }: {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
}) {
  if (field !== currentField) return null;
  return (
    <span className="ml-1 inline-block">
      {direction === 'asc' ? <FiArrowUp className="inline w-3 h-3" /> : <FiArrowDown className="inline w-3 h-3" />}
    </span>
  );
}

function ColumnHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  centered = false
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  centered?: boolean;
}) {
  const baseClasses = `
    flex-1 px-4 py-3 text-xs font-medium 
    text-gray-500 dark:text-gray-400 uppercase 
    cursor-pointer hover:text-gray-700 
    dark:hover:text-gray-200 transition-colors
    ${field === sortField ? 'text-indigo-600 dark:text-indigo-400' : ''}
    ${centered ? 'text-center' : ''}
  `;
  return (
    <div className={baseClasses} onClick={() => onSort(field)}>
      <span className="flex items-center justify-center gap-1">
        {label}
        <SortIndicator field={field} currentField={sortField} direction={sortDirection} />
      </span>
    </div>
  );
}

export default function OverviewPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [view, setView] = useState<"project" | "workflow">("project");
  const itemsPerPage = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const sortData = <T extends Project | Workflow>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const aValue = a[sortField as keyof T];
      const bValue = b[sortField as keyof T];
      const modifier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'boolean') {
        return (aValue === bValue ? 0 : aValue ? 1 : -1) * modifier;
      }
      if (typeof aValue === 'string') {
        return aValue.localeCompare(String(bValue)) * modifier;
      }
      return ((aValue as number) - (bValue as number)) * modifier;
    });
  };

  const filteredProjects = sortData(
    mockProjects.filter(proj =>
      proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredWorkflows = sortData(
    mockWorkflows.filter(wf =>
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const data = view === "project" ? filteredProjects : filteredWorkflows;
  const totalEntries = data.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const pageData = data.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div className="p-6 flex flex-col h-screen bg-white dark:bg-gray-900">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
          Overview
        </h1>
        <div className="flex items-center gap-4">
          <select
            value={view}
            onChange={(e) => {
              setView(e.target.value as "project" | "workflow");
              setSortField("name");
              setCurrentPage(1);
            }}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="project">Projects</option>
            <option value="workflow">Workflows</option>
          </select>
          <input
            type="text"
            placeholder={`Search ${view}s...`}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 rounded-lg overflow-hidden min-h-0">
        <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex">
            <ColumnHeader field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            {view === "project" ? (
              <>
                <ColumnHeader field="description" label="Description" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <ColumnHeader field="workflowCount" label="Workflows" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} centered />
                <ColumnHeader field="scheduledCount" label="Scheduled" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} centered />
                <ColumnHeader field="deployedCount" label="Deployed" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} centered />
              </>
            ) : (
              <>
                <ColumnHeader field="projectName" label="Project" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <ColumnHeader field="isPublished" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} centered />
              </>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto">
          {pageData.map((item) => {
            if (view == 'project') {
              item = item as Project;
              return (
                <div key={item.id} style={{ height: ROW_H }} className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                  <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">{item.name}</div>
                  <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{item.description}</div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-gray-800 dark:text-gray-100">{item.workflowCount}</div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-yellow-600 dark:text-yellow-400">{item.scheduledCount}</div>
                  <div className="flex-1 px-4 py-2 text-center text-sm text-green-600 dark:text-green-400">{item.deployedCount}</div>
                </div>
              )
            }
            else {
              item = item as Workflow;
              return (
                <div key={item.id} style={{ height: ROW_H }} className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                  <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">{item.name}</div>
                  <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{item.projectName}</div>
                  <div className="flex-1 px-4 py-2 flex justify-center">
                    {item.isPublished ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              )
            }
          }
          )}
        </div>

        <div className="flex-none border-t border-gray-200 dark:border-gray-700 flex items-center justify-center py-3">
          <div className="inline-flex items-center space-x-1">
            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
              <FiChevronLeft />
            </button>
            {getPaginationRange(currentPage, totalPages).map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-2 select-none">…</span>
              ) : (
                <button key={item} onClick={() => setCurrentPage(item)} className={`px-3 py-1 rounded-md focus:outline-none ${item === currentPage ? "bg-indigo-600 dark:bg-indigo-500 text-white" : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700"}`}>
                  {item}
                </button>
              )
            )}
            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
