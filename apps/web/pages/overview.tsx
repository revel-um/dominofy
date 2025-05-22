import React, { useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

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
    { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
    { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
    { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
    { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
    { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
    { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
    { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
    { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
    { id: "p1", name: "Marketing Automation", description: "Automates the email marketing process", workflowCount: 3, scheduledCount: 2, deployedCount: 1 },
    { id: "p2", name: "Salesforce Sync", description: "Keeps Salesforce in sync with internal DB", workflowCount: 2, scheduledCount: 1, deployedCount: 1 },
];

const mockWorkflows: Workflow[] = [
    { id: "w1", name: "Weekly Campaign", projectName: "Marketing Automation", visualJson: { nodes: [], edges: [] }, isPublished: true },
    { id: "w2", name: "New User Onboarding", projectName: "Marketing Automation", visualJson: { nodes: [], edges: [] }, isPublished: false },
    { id: "w3", name: "Lead Sync", projectName: "Salesforce Sync", visualJson: { nodes: [], edges: [] }, isPublished: true },
];

function getPaginationRange(
    current: number,
    total: number,
    siblingCount = 1
): (number | "ellipsis")[] {
    const totalNumbers = siblingCount * 2 + 5; // first + last + current block + 2 ellipses
    if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

    const left = Math.max(current - siblingCount, 2);
    const right = Math.min(current + siblingCount, total - 1);

    const range: (number | "ellipsis")[] = [1]; // first page

    if (left > 2) range.push("ellipsis");

    for (let i = left; i <= right; i++) range.push(i);

    if (right < total - 1) range.push("ellipsis");

    range.push(total); // last page
    return range;
}

const ROW_H = "calc(100% / 10)"; // one-tenth of the list panel

export default function OverviewPage({ view = "project" }: { view?: "project" | "workflow" }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredProjects = mockProjects.filter((proj) =>
        proj.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredWorkflows = mockWorkflows.filter((wf) =>
        wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const data = view === "project" ? filteredProjects : filteredWorkflows;
    const totalEntries = data.length;
    const totalPages = Math.ceil(totalEntries / itemsPerPage);

    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageData = data.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className="p-6 flex flex-col h-screen bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 capitalize">
                    {view} Overview
                </h1>
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

            {/* Unified list + pagination card */}
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 rounded-lg overflow-hidden min-h-0">
                {/* Column headers */}
                <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <div className="flex">
                        <div className="flex-1 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Name
                        </div>
                        {view === "project" ? (
                            <>
                                <div className="flex-1 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Description
                                </div>
                                <div className="flex-1 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Workflows
                                </div>
                                <div className="flex-1 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Scheduled
                                </div>
                                <div className="flex-1 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Deployed
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex-1 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Project
                                </div>
                                <div className="flex-1 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    Status
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Data rows */}
                <div className="flex-1 flex flex-col divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto">
                    {pageData.map((item) =>
                        view === "project" ? (
                            /* ------------ project row ------------ */
                            <div
                                key={(item as Project).id}
                                style={{ height: ROW_H }}
                                className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                onClick={() => console.log("Project clicked:", (item as Project).id)}
                            >
                                <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                                    {(item as Project).name}
                                </div>
                                <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    {(item as Project).description}
                                </div>
                                <div className="flex-1 px-4 py-2 text-center text-sm text-gray-800 dark:text-gray-100">
                                    {(item as Project).workflowCount}
                                </div>
                                <div className="flex-1 px-4 py-2 text-center text-sm text-yellow-600 dark:text-yellow-400">
                                    {(item as Project).scheduledCount}
                                </div>
                                <div className="flex-1 px-4 py-2 text-center text-sm text-green-600 dark:text-green-400">
                                    {(item as Project).deployedCount}
                                </div>
                            </div>
                        ) : (
                            /* ------------ workflow row ------------ */
                            <div
                                key={(item as Workflow).id}
                                style={{ height: ROW_H }}
                                className="flex-shrink-0 flex items-center hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                onClick={() => console.log("Workflow clicked:", (item as Workflow).id)}
                            >
                                <div className="flex-1 px-4 py-2 text-sm text-gray-800 dark:text-gray-100">
                                    {(item as Workflow).name}
                                </div>
                                <div className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    {(item as Workflow).projectName}
                                </div>
                                <div className="flex-1 px-4 py-2 flex justify-center">
                                    {(item as Workflow).isPublished ? (
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
                    )}
                </div>

                {/* Pagination – now inside the same card */}
                <div className="flex-none border-t border-gray-200 dark:border-gray-700 flex items-center justify-center py-3">
                    <div className="inline-flex items-center space-x-1">
                        {/* Prev */}
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            <FiChevronLeft />
                        </button>

                        {/* Page numbers + ellipses */}
                        {getPaginationRange(currentPage, totalPages).map((item, idx) =>
                            item === "ellipsis" ? (
                                <span key={`ellipsis-${idx}`} className="px-2 select-none">
                                    …
                                </span>
                            ) : (
                                <button
                                    key={item}
                                    onClick={() => setCurrentPage(item)}
                                    className={`px-3 py-1 rounded-md focus:outline-none ${item === currentPage
                                        ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                                        : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700"
                                        }`}
                                >
                                    {item}
                                </button>
                            )
                        )}

                        {/* Next */}
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            <FiChevronRight />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

}
