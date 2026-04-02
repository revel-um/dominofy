import type { CSSProperties, ComponentType } from "react";

import {
  BoomBox,
  Calculator,
  BrainCircuit,
  Braces,
  CalendarClock,
  CheckCheck,
  CloudDownload,
  Combine,
  FileQuestion,
  FileSpreadsheet,
  Filter as FilterIcon,
  FolderSync,
  Database,
  GitBranch,
  Mail,
  Printer,
  ScanSearch,
  TimerReset,
  ToggleLeftIcon,
  Webhook,
  Workflow,
  WandSparkles,
  Plug,
  Code2,
} from "lucide-react";

import { FiFileText } from "react-icons/fi";
import { SiGoogledrive, SiSlack } from "react-icons/si";

export type DominoCatalogEntry = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  categories: string[];
  badgeStyle: CSSProperties;
  iconStyle: CSSProperties;
};

export default [
  {
    id: "llm",
    label: "AI",
    description: "Run a prompt through an AI language model",
    icon: BrainCircuit,
    categories: ["AI"],
    badgeStyle: {
      background:
        "linear-gradient(135deg, #d946ef 0%, #8b5cf6 55%, #4f46e5 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "response",
    label: "Response",
    description: "Return the final output of the pipeline",
    icon: CheckCheck,
    categories: ["Output"],
    badgeStyle: {
      background: "linear-gradient(135deg, #34d399 0%, #0d9488 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "SchedulerDomino",
    label: "Scheduler",
    description: "Trigger the pipeline on a recurring schedule",
    icon: CalendarClock,
    categories: ["Trigger"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fbbf24 0%, #ea580c 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "emailtrigger",
    label: "Email Trigger",
    description: "Start the pipeline when an email is received",
    icon: Mail,
    categories: ["Trigger", "Email"],
    badgeStyle: {
      background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "emailsender",
    label: "Email Action",
    description: "Send an email to one or more recipients",
    icon: Mail,
    categories: ["Action", "Email"],
    badgeStyle: {
      background: "linear-gradient(135deg, #22d3ee 0%, #0284c7 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "csvwriter",
    label: "CSV Writer",
    description: "Export data as a CSV file",
    icon: FileSpreadsheet,
    categories: ["Output"],
    badgeStyle: {
      background: "linear-gradient(135deg, #34d399 0%, #15803d 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "print",
    label: "Print",
    description: "Log a value to the console or output",
    icon: Printer,
    categories: ["Output"],
    badgeStyle: {
      background: "linear-gradient(135deg, #64748b 0%, #334155 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "apicall",
    label: "API Call",
    description: "Make an HTTP request to an external API",
    icon: Webhook,
    categories: ["Action"],
    badgeStyle: {
      background: "linear-gradient(135deg, #3b82f6 0%, #4338ca 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "apitrigger",
    label: "API Trigger",
    description: "Start the pipeline via an incoming webhook",
    icon: WandSparkles,
    categories: ["Trigger"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fde047 0%, #f59e0b 100%)",
    },
    iconStyle: { color: "#0f172a" },
  },
  {
    id: "readexcel",
    label: "Read File",
    description: "Read and parse an Excel or CSV file",
    icon: FiFileText,
    categories: ["Input"],
    badgeStyle: {
      background: "linear-gradient(135deg, #22c55e 0%, #65a30d 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "googleDrive",
    label: "Google Drive",
    description: "Upload or manage files in Google Drive",
    icon: SiGoogledrive,
    categories: ["Action", "Storage"],
    badgeStyle: { background: "#ffffff", border: "1px solid #e2e8f0" },
    iconStyle: { color: "#0F9D58" },
  },
  {
    id: "googleDriveDownload",
    label: "Google Drive Download",
    description: "Download a file from Google Drive",
    icon: CloudDownload,
    categories: ["Action", "Storage"],
    badgeStyle: {
      background: "linear-gradient(135deg, #22d3ee 0%, #1d4ed8 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "storage",
    label: "Database",
    description: "Insert or update records in a database",
    icon: Database,
    categories: ["Action", "Storage"],
    badgeStyle: {
      background: "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "storageRetrieve",
    label: "Database Retrieval",
    description: "Query and retrieve records from a database",
    icon: Database,
    categories: ["Input", "Storage"],
    badgeStyle: {
      background: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "condition",
    label: "Condition",
    description: "Branch the flow based on a true/false check",
    icon: FileQuestion,
    categories: ["Logic"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fb7185 0%, #db2777 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "switchcase",
    label: "Switch",
    description: "Route flow to one of many branches by value",
    icon: ToggleLeftIcon,
    categories: ["Logic"],
    badgeStyle: {
      background: "linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "arithmetic",
    label: "Arithmetic",
    description: "Perform math operations on numeric values",
    icon: Calculator,
    categories: ["Logic"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fb923c 0%, #dc2626 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "jointext",
    label: "Join Text",
    description: "Concatenate multiple strings into one",
    icon: Combine,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #e879f9 0%, #be185d 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "constructor",
    label: "Constructor",
    description: "Build an object from multiple keyed values",
    icon: Braces,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "deconstructor",
    label: "De-Construct",
    description: "Break an object into individual fields",
    icon: BoomBox,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #67e8f9 0%, #0369a1 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "iterator",
    label: "Iterator",
    description: "Loop over each item in a list",
    icon: Workflow,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #818cf8 0%, #1d4ed8 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "aggregator",
    label: "Aggregator",
    description: "Collect and combine items from an iterator",
    icon: FolderSync,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #2dd4bf 0%, #0e7490 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "filter",
    label: "Filter",
    description: "Keep only items that match a condition",
    icon: FilterIcon,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #34d399 0%, #0f766e 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "sqlRunner",
    label: "SQL Runner",
    description: "Execute a raw SQL query on a database",
    icon: ScanSearch,
    categories: ["Action"],
    badgeStyle: {
      background: "linear-gradient(135deg, #475569 0%, #0f172a 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "codeRunner",
    label: "Custom Code",
    description: "Run arbitrary JavaScript in the pipeline",
    icon: Code2,
    categories: ["Action"],
    badgeStyle: {
      background: "linear-gradient(135deg, #64748b 0%, #3730a3 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "delay",
    label: "Delay",
    description: "Pause execution for a set amount of time",
    icon: TimerReset,
    categories: ["Logic"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fcd34d 0%, #ea580c 100%)",
    },
    iconStyle: { color: "#0f172a" },
  },
  {
    id: "mapper",
    label: "Mapper",
    description: "Transform data fields from one shape to another",
    icon: GitBranch,
    categories: ["Data Transformation"],
    badgeStyle: {
      background: "linear-gradient(135deg, #c084fc 0%, #4338ca 100%)",
    },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "slacktrigger",
    label: "Slack Trigger",
    description: "Start the pipeline from a Slack event",
    icon: SiSlack,
    categories: ["Trigger", "Slack"],
    badgeStyle: { background: "#4A154B" },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "slackaction",
    label: "Slack Action",
    description: "Send a message or action to a Slack channel",
    icon: SiSlack,
    categories: ["Action", "Slack"],
    badgeStyle: { background: "#611f69" },
    iconStyle: { color: "#ffffff" },
  },
  {
    id: "connector",
    label: "Connector/Merger",
    description: "Merge multiple branches into a single flow",
    icon: Plug,
    categories: ["Logic"],
    badgeStyle: {
      background: "linear-gradient(135deg, #bef264 0%, #15803d 100%)",
    },
    iconStyle: { color: "#020617" },
  },
  {
    id: "note",
    label: "Note",
    description: "Add a comment or annotation to the canvas",
    icon: FiFileText,
    categories: ["Utility"],
    badgeStyle: {
      background: "linear-gradient(135deg, #fef08a 0%, #fbbf24 100%)",
    },
    iconStyle: { color: "#78350f" },
  },
  // {
  //   id: 'webhook',
  //   label: 'Webhook',
  //   icon: Braces,
  //   categories: ['Trigger'],
  //   badgeStyle: { background: 'linear-gradient(135deg, #60a5fa 0%, #0e7490 100%)' },
  //   iconStyle: { color: '#ffffff' }
  // },
] satisfies DominoCatalogEntry[];
