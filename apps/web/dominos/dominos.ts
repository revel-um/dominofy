
import { BoomBox, Calculator, FileQuestion, ToggleLeftIcon, CheckCircle, Slack, Clock, Filter, Plug } from 'lucide-react';
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
  },
  {
    id: 'response',
    label: 'Response',
    icon: FiCheckCircle,
  },
  {
    id: 'SchedulerDomino',
    label: 'Scheduler',
    icon: FiClock,
  },
  {
    id: 'emailsender',
    label: 'Email Sender',
    icon: FiMail
  },
  {
    id: 'csvwriter',
    label: 'CSV Writer',
    icon: FiDownload
  },
  {
    id: 'print',
    label: 'Print',
    icon: FiPrinter
  },
  {
    id: 'apicall',
    label: 'API Call',
    icon: FiGlobe
  },
  {
    id: 'apitrigger',
    label: 'API Trigger',
    icon: FiZap
  },
  {
    id: 'readexcel',
    label: 'Read Excel',
    icon: FiFileText
  },
  {
    id: 'condition',
    label: 'Condition',
    icon: FileQuestion
  },
  {
    id: 'switchcase',
    label: 'Switch',
    icon: ToggleLeftIcon
  },
  {
    id: 'arithmetic',
    label: 'Arithmetic',
    icon: Calculator
  },
  {
    id: 'deconstructor',
    label: 'Deconstruct',
    icon: BoomBox
  },
  {
    id: 'iterator',
    label: 'Iterator',
    icon: FiRepeat
  },
  {
    id: 'aggregator',
    label: 'Aggregator',
    icon: FiLayers
  },
  {
    id: 'filter',
    label: 'Filter',
    icon: Filter
  },
  {
    id: 'sqlRunner',
    label: 'SQL Runner',
    icon: FiCode
  },
  {
    id: 'codeRunner',
    label: 'Code Runner',
    icon: FiCode
  },
  {
    id: 'delay',
    label: 'Delay',
    icon: FiClock
  },
  {
    id: 'mapper',
    label: 'Mapper',
    icon: FiLayers
  },
  {
    id: 'slacktrigger',
    label: 'Slack Trigger',
    icon: Slack
  },
  {
    id: 'connector',
    label: 'Connector',
    icon: Plug
  },
  {
    id: 'shopify',
    label: 'Shopify',
    icon: FiShoppingBag
  },
  {
    id: 'webhook',
    label: 'Webhook',
    icon: FiGlobe
  },
];
