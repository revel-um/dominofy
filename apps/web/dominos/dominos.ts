import {
  BoomBox,
  Calculator,
  FileQuestion,
  ToggleLeftIcon,
  CheckCircle,
  Slack,
  Clock,
  Filter,
  Plug
} from 'lucide-react';

import {
  FiPrinter,
  FiGlobe,
  FiZap,
  FiFileText,
  FiRepeat,
  FiLayers,
  FiCode,
  FiClock,
  FiMail,
  FiDownload,
  FiCheckCircle,
  FiCpu,
  FiShoppingBag,
} from 'react-icons/fi';

export default [
  {
    id: 'llm',
    label: 'LLM',
    icon: FiCpu,
    categories: ['AI']
  },
  {
    id: 'response',
    label: 'Response',
    icon: FiCheckCircle,
    categories: ['Output']
  },
  {
    id: 'SchedulerDomino',
    label: 'Scheduler',
    icon: FiClock,
    categories: ['Trigger']
  },
  {
    id: 'emailsender',
    label: 'Email Sender',
    icon: FiMail,
    categories: ['Action']
  },
  {
    id: 'csvwriter',
    label: 'CSV Writer',
    icon: FiDownload,
    categories: ['Output']
  },
  {
    id: 'print',
    label: 'Print',
    icon: FiPrinter,
    categories: ['Output']
  },
  {
    id: 'apicall',
    label: 'API Call',
    icon: FiGlobe,
    categories: ['Action']
  },
  {
    id: 'apitrigger',
    label: 'API Trigger',
    icon: FiZap,
    categories: ['Trigger']
  },
  {
    id: 'readexcel',
    label: 'Read Excel',
    icon: FiFileText,
    categories: ['Input']
  },
  {
    id: 'condition',
    label: 'Condition',
    icon: FileQuestion,
    categories: ['Logic']
  },
  {
    id: 'switchcase',
    label: 'Switch',
    icon: ToggleLeftIcon,
    categories: ['Logic']
  },
  {
    id: 'arithmetic',
    label: 'Arithmetic',
    icon: Calculator,
    categories: ['Logic']
  },
  {
    id: 'deconstructor',
    label: 'Deconstruct',
    icon: BoomBox,
    categories: ['Data Transformation']
  },
  {
    id: 'iterator',
    label: 'Iterator',
    icon: FiRepeat,
    categories: ['Data Transformation']
  },
  {
    id: 'aggregator',
    label: 'Aggregator',
    icon: FiLayers,
    categories: ['Data Transformation']
  },
  {
    id: 'filter',
    label: 'Filter',
    icon: Filter,
    categories: ['Data Transformation']
  },
  {
    id: 'sqlRunner',
    label: 'SQL Runner',
    icon: FiCode,
    categories: ['Action']
  },
  {
    id: 'codeRunner',
    label: 'Code Runner',
    icon: FiCode,
    categories: ['Action']
  },
  {
    id: 'delay',
    label: 'Delay',
    icon: FiClock,
    categories: ['Logic']
  },
  {
    id: 'mapper',
    label: 'Mapper',
    icon: FiLayers,
    categories: ['Data Transformation']
  },
  {
    id: 'slacktrigger',
    label: 'Slack Trigger',
    icon: Slack,
    categories: ['Trigger', 'Slack']
  },
  {
    id: 'slackaction',
    label: 'Slack Action',
    icon: Slack,
    categories: ['Action', 'Slack']
  },
  {
    id: 'connector',
    label: 'Connector',
    icon: Plug,
    categories: ['Logic']
  },
  {
    id: 'shopify',
    label: 'Shopify',
    icon: FiShoppingBag,
    categories: ['Shopify']
  },
  {
    id: 'note',
    label: 'Note',
    icon: FiFileText,
    categories: ['Utility']
  },
  {
    id: 'webhook',
    label: 'Webhook',
    icon: FiGlobe,
    categories: ['Trigger']
  },
];
