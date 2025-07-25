
import { BoomBox, Calculator, FileQuestion, ToggleLeftIcon, CheckCircle, Slack, Clock, Filter } from 'lucide-react';
import {
  FiPrinter,
  FiGlobe,
  FiZap,
  FiFileText,
  FiRepeat,
  FiDatabase,
  FiLayers,
  FiCode,
  FiClock,
  FiMail,
  FiDownload,
  FiCheckCircle,
  FiCpu,
} from 'react-icons/fi';

export default [
  {
    id: 'llm',
    label: 'LLM',
    icon: FiCpu, // Represents AI/ML processing
    category: 'AI/LLM',
  },
  {
    id: 'response',
    label: 'Response',
    icon: FiCheckCircle, // ✅ Represents successful completion/response
    category: 'Core',
  },
  {
    id: 'SchedulerDomino',
    label: 'Scheduler',
    icon: FiClock, // ⏰ Represents scheduling and timing
  },
  {
    id: 'emailsender',
    label: 'Email Sender',
    icon: FiMail,
    description: 'Send emails via SMTP or API providers',
    category: 'Communication',
    color: 'red',
    fields: [
      { heading: 'From', type: 'text', required: true },
      { heading: 'To', type: 'text', required: true },
      { heading: 'Subject', type: 'text', required: false },
      { heading: 'Body', type: 'text', required: true, multiline: true },
      { heading: 'CC', type: 'text', required: false },
      { heading: 'BCC', type: 'text', required: false }
    ]
  },
  {
    id: 'csvwriter',
    label: 'CSV Writer',
    icon: FiDownload, // 📥 Represents downloading data
  },
  {
    id: 'print',
    label: 'Print',
    icon: FiPrinter,
    description: 'Print values to the console',
    category: 'Utility',
    color: 'blue'
  },
  {
    id: 'apicall',
    label: 'API Call',
    icon: FiGlobe,
    description: 'Make HTTP requests to external APIs',
    category: 'Integration',
    color: 'green'
  },
  {
    id: 'apitrigger',
    label: 'API Trigger',
    icon: FiZap,
    description: 'Trigger workflows via HTTP requests',
    category: 'Integration',
    color: 'purple'
  },
  {
    id: 'readexcel',
    label: 'Read Excel',
    icon: FiFileText,
    description: 'Read data from Excel files',
    category: 'Data',
    color: 'green'
  },
  {
    id: 'condition',
    label: 'Condition',
    icon: FileQuestion,
    description: 'Conditional logic and branching',
    category: 'Logic',
    color: 'yellow'
  },
  {
    id: 'switchcase',
    label: 'Switch',
    icon: ToggleLeftIcon,
    description: 'Multi-branch conditional logic',
    category: 'Logic',
    color: 'yellow'
  },
  {
    id: 'arithmetic',
    label: 'Arithmetic',
    icon: Calculator,
    description: 'Mathematical operations',
    category: 'Math',
    color: 'blue'
  },
  {
    id: 'deconstructor',
    label: 'Deconstruct',
    icon: BoomBox,
    description: 'Extract values from objects and arrays',
    category: 'Data',
    color: 'purple'
  },
  {
    id: 'iterator',
    label: 'Iterator',
    icon: FiRepeat,
    description: 'Loop over arrays or objects',
    category: 'Data',
    color: 'green'
  },
  {
    id: 'dbSetup',
    label: 'Database Setup',
    icon: FiDatabase,           // 🔁 Iterate over list
  },
  {
    id: 'aggregator',
    label: 'Aggregator',
    icon: FiLayers, // ➕ Accumulate values using sum, multiply, min, or max
  },
  {
    id: 'filter',
    label: 'Filter',
    icon: Filter, // 🔍 Filter array of objects based on conditions
    description: 'Combine multiple values into one',
    category: 'Data',
    color: 'blue'
  },
  {
    id: 'sqlRunner',
    label: 'SQL Runner',
    icon: FiCode, // ➕ Accumulate values using sum, multiply, min, or max
  },
  {
    id: 'codeRunner',
    label: 'Code Runner',
    icon: FiCode, // ➕ Accumulate values using sum, multiply, min, or max
  },
  {
    id: 'delay',
    label: 'Delay',
    icon: FiClock, // ⏳ Represents a delay or timeout
  },
  {
    id: 'mapper',
    label: 'Mapper',
    icon: FiLayers,
  },
  { // 🗺️ Maps inputs to outputs
    id: 'slacktrigger',
    label: 'Slack Trigger',
    icon: Slack, // 💬 Listens for new messages in a Slack channel
  }
];
