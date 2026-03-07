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
  FiCloud,
  FiCreditCard,
  FiUser,
  FiActivity,
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
    id: 'emailtrigger',
    label: 'Email Trigger',
    icon: FiMail,
    categories: ['Trigger', 'Email']
  },
  {
    id: 'emailsender',
    label: 'Email Action',
    icon: FiMail,
    categories: ['Action', 'Email']
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
    id: 'googleDrive',
    label: 'Google Drive',
    icon: FiCloud,
    categories: ['Action', 'Storage']
  },
  {
    id: 'googleDriveDownload',
    label: 'Google Drive Download',
    icon: FiDownload,
    categories: ['Action', 'Storage']
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
  {
    id: 'paymentCreateRecipient',
    label: 'Create Recipient',
    icon: FiUser,
    categories: ['Payments']
  },
  {
    id: 'paymentAddBankInstrument',
    label: 'Add Bank Instrument',
    icon: FiCreditCard,
    categories: ['Payments']
  },
  {
    id: 'paymentAddUpiInstrument',
    label: 'Add UPI Instrument',
    icon: FiCreditCard,
    categories: ['Payments']
  },
  {
    id: 'paymentSinglePayout',
    label: 'Single Payout',
    icon: FiCreditCard,
    categories: ['Payments']
  },
  {
    id: 'paymentBulkPayout',
    label: 'Bulk Payout',
    icon: FiCreditCard,
    categories: ['Payments']
  },
  {
    id: 'paymentWaitForCompletion',
    label: 'Wait For Payout',
    icon: FiActivity,
    categories: ['Payments']
  },
];
