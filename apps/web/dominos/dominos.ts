import { BoomBox, Calculator, FileQuestion, ToggleLeftIcon, Filter } from 'lucide-react';
import {
  FiPrinter,
  FiGlobe,
  FiZap,
  FiFileText,
  FiRepeat,
  FiLayers
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
  },
  {
    id: 'deconstructor',
    label: 'Deconstruct',
    icon: BoomBox, // 📄 Represents reading a local file
  },
  {
    id: 'iterator',
    label: 'Iterator',
    icon: FiRepeat,           // 🔁 Iterate over list
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
  }
];
