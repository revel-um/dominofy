import React from "react";
import { FiCalendar, FiClock, FiFolder, FiGitMerge, FiUploadCloud } from "react-icons/fi";

interface DashboardInsightsProps {
  projectCount: number;
  workflowCount: number;
}

const DashboardInsightsPanel: React.FC<DashboardInsightsProps> = ({
  projectCount,
  workflowCount,
}) => {
  return (
    <div className="w-full">
      <p className="text-sm text-gray-500 mb-3 text-center font-bold">Quick Access</p>
      <StatCard icon={<FiFolder size={18} />} label="Total Projects" value={projectCount} />
      <StatCard icon={<FiGitMerge size={18} />} label="Total Workflows" value={workflowCount ?? "Loading..."} />
      <StatCard icon={<FiCalendar size={18} />} label="Scheduled Tasks" value={0} />
      <StatCard icon={<FiUploadCloud size={18} />} label="Deployed Tasks" value={0} />
      <StatCard icon={<FiClock size={18} />} label="Remaining Tasks" value={0} />
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between w-full px-4 py-3 border-b last:border-b-0 hover:bg-gray-50">
    <div className="flex items-center gap-2 text-gray-700">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <span className="text-sm font-semibold text-gray-900">{value}</span>
  </div>
);

export default DashboardInsightsPanel;
