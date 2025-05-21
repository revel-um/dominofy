import React from "react";
import { FiCalendar, FiClock, FiFolder, FiGitMerge, FiUploadCloud } from "react-icons/fi";

interface DashboardInsightsProps {
  projectCount: number;
  workflowCount: number;
}

export const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="flex items-center justify-between w-full px-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-black // Custom near-black, softer than pure black
 transition-colors">
    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>
  </div>
);

export function DashboardInsightsPanel({
  projectCount,
  workflowCount,
}: DashboardInsightsProps) {
  return (
    <div className="w-full">
      <p className="mb-3 text-center text-sm font-bold text-gray-500 dark:text-gray-400">Quick Access</p>
      <StatCard icon={<FiFolder size={18} />} label="Total Projects" value={projectCount} />
      <StatCard icon={<FiGitMerge size={18} />} label="Total Workflows" value={workflowCount ?? "Loading..."} />
      <StatCard icon={<FiCalendar size={18} />} label="Scheduled Workflows" value={0} />
      <StatCard icon={<FiUploadCloud size={18} />} label="Deployed Workflows" value={0} />
      <StatCard icon={<FiClock size={18} />} label="Remaining Workflows" value={0} />
    </div>
  );
}

export default DashboardInsightsPanel;
