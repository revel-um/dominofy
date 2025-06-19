import { Calculator, FileQuestion, ToggleLeftIcon } from 'lucide-react';
import {
  FiPrinter,
  FiGlobe,
  FiZap,
  FiFileText
} from 'react-icons/fi';

export default [
  {
    id: 'print',
    label: 'Print',
    icon: FiPrinter, // 🖨️ Prints output
  },
  {
    id: 'apicall',
    label: 'API Call',
    icon: FiGlobe, // ⬇️ Represents fetching data
  },
  {
    id: 'apitrigger',
    label: 'API Trigger',
    icon: FiZap, // ⚡️ Represents an active trigger or webhook
  },
  {
    id: 'readexcel',
    label: 'Read Excel',
    icon: FiFileText, // 📄 Represents reading a local file
  },
  {
    id: 'condition',
    label: 'Condition Operator',
    icon: FileQuestion, // 📄 Represents reading a local file
  },
  {
    id: 'switchcase',
    label: 'Switch Operator',
    icon: ToggleLeftIcon, // 📄 Represents reading a local file
  },
  {
    id: 'arithmetic',
    label: 'Arithmetic Operator',
    icon: Calculator, // 📄 Represents reading a local file
  }
];
