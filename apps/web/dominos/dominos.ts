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
    id: 'readfile',
    label: 'Read File',
    icon: FiFileText, // 📄 Represents reading a local file
  }
];
