import type { ComponentType } from "react";

// --- Prop types for each rendering context ---

export interface CellDisplayProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
  isSelected?: boolean;
}

export interface CellEditorProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
  onSave: (value: any) => void;
  onCancel: () => void;
  cellRect?: DOMRect;
}

export interface KanbanDisplayProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
}

export interface KanbanEditorProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
  onSave: (value: any) => void;
  onCancel: () => void;
}

export interface DetailDisplayProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
}

export interface DetailEditorProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
  onSave: (value: any) => void;
  onCancel: () => void;
}

export interface FormInputProps {
  value: any;
  config: Record<string, any>;
  attribute: Attribute;
  onChange: (value: any) => void;
  error?: string;
}

export interface TypeConfigProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

export interface FilterProps {
  operator: string;
  value: any;
  config: Record<string, any>;
  onChange: (operator: string, value: any) => void;
}

// --- Supporting types ---

export interface Attribute {
  id: string;
  name: string;
  columnName: string;
  uiType: string;
  sqlType: string;
  config: Record<string, any>;
  isPrimary: boolean;
  isSystem: boolean;
  isHiddenByDefault: boolean;
  icon?: string;
  order: number;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface FilterOperator {
  key: string;
  label: string;
  requiresValue: boolean;
}

export type CalculationType =
  | "count"
  | "count_empty"
  | "count_not_empty"
  | "percent_empty"
  | "percent_not_empty"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "median"
  | "count_values"
  | "percent_values"
  | "count_checked"
  | "count_unchecked"
  | "percent_checked"
  | "earliest"
  | "latest"
  | "date_range";

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface StatusOption extends SelectOption {
  order: number;
  isTerminal?: boolean;
}

// --- The main FieldTypeDefinition interface ---

export interface FieldTypeDefinition {
  key: string;
  label: string;
  icon: ComponentType;
  group: "standard" | "relational" | "ai-autofill";

  hasTypeConfig: boolean;
  TypeConfigComponent: ComponentType<TypeConfigProps> | null;
  defaultTypeConfig: Record<string, any>;

  CellDisplay: ComponentType<CellDisplayProps>;
  KanbanDisplay: ComponentType<KanbanDisplayProps>;
  DetailDisplay: ComponentType<DetailDisplayProps>;

  CellEditor: ComponentType<CellEditorProps>;
  KanbanEditor: ComponentType<KanbanEditorProps>;
  FormInput: ComponentType<FormInputProps>;
  DetailEditor: ComponentType<DetailEditorProps>;

  editorStyle: "inline" | "popover" | "expanding" | "toggle";

  validate: (value: any, config: Record<string, any>) => ValidationResult;

  parseValue: (raw: any) => any;
  serializeValue: (value: any) => any;
  getEmptyValue: () => any;
  isEmpty: (value: any) => boolean;
  formatDisplayValue: (value: any, config: Record<string, any>) => string;

  comparator: (a: any, b: any, config?: Record<string, any>) => number;
  FilterComponent: ComponentType<FilterProps> | null;
  filterOperators: FilterOperator[];

  availableCalculations: CalculationType[];
  calculate: (values: any[], calcType: CalculationType) => any;

  placeholder: string;
  searchPlaceholder?: string;
}
