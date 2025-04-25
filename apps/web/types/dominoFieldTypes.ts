export type DominoFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'dropdown'
  | 'multi-select'
  | 'code'
  | 'textarea'
  | 'json'
  | 'date'
  | 'file';

export interface DominoFieldOption {
  label: string;
  value: string;
}

export interface DominoField {
  key: string; // e.g., "username"
  label: string; // e.g., "User Name"
  type: DominoFieldType;
  value: any;
  options?: DominoFieldOption[]; // For dropdown and multi-select
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

interface DominoNodeData {
  type: string; // e.g., "Print", "HTTP Request", etc.
  fields: DominoField[];
  setNodes?: (updater: any) => void;
  updatePipeline?: (nodes: any[]) => void;
  selected?: boolean;
  [key: string]: any; // Extra props if needed
}
