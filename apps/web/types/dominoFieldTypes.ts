import { FileInput } from "lucide-react";
import { Checkbox } from "../components/widgets/checkbox";
import { CodeInput } from "../components/widgets/codeInput";
import { DateInput } from "../components/widgets/dateInput";
import { Dropdown } from "../components/widgets/dropdown";
import { JsonInput } from "../components/widgets/jsonInput";
import { MultiSelect } from "../components/widgets/multiselect";
import { TextWidget } from "../components/widgets/textWidget";
import { TextInput } from "../components/widgets/textInput";
import { CopyWidget } from "../components/widgets/copyWidget";
import { KeyValInput } from "../components/widgets/keyValue";

export type WidgetType =
  | 'text'
  | 'checkbox'
  | 'dropdown'
  | 'multiSelect'
  | 'code'
  | 'textInput'
  | 'json'
  | 'date'
  | 'file'
  | 'copy'
  | 'switch'
  | 'password';

export interface DominoFieldOption {
  label: string;
  value: string;
}

export interface DominoField {
  type: WidgetType;
  value: any;
  inPinId?: string;
  connectedValue?: string;
  onChange?: Function;
  options?: DominoFieldOption[]; // For dropdown and multi-select
  placeholder?: string;
  required?: boolean;
  heading?: string;
  shouldRender?: boolean; // For conditional rendering
  needsUpload?: boolean; // For file inputs
  file?: {key: string, url: string}; // For file inputs
  exportOverride?: string | string[]
  connectedPin?: string; // For multi-pin connections
}

export interface DominoNodeData {
  type: string; // e.g., "Print", "HTTP Request", etc.
  description?: string; // e.g., "Print a document", "Make an HTTP request", etc.
  fields: DominoField[];
  setNodes?: (updater: any) => void;
  updatePipeline?: (nodes: any[]) => void;
  [key: string]: any; // Extra props if needed
  isTrigger?: boolean;
}

export const fieldWidgetMap = {
  text: TextWidget,
  checkbox: Checkbox,
  dropdown: Dropdown,
  multiSelect: MultiSelect,
  code: CodeInput,
  textInput: TextInput,
  json: JsonInput,
  date: DateInput,
  file: FileInput,
  copy: CopyWidget,
  keyVal: KeyValInput
};
