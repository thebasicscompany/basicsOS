import { CheckSquareIcon } from "@phosphor-icons/react";
import type { FieldTypeDefinition, CalculationType } from "@/field-types/types";
import { CheckboxCellDisplay } from "./CheckboxCellDisplay";
import { CheckboxCellEditor } from "./CheckboxCellEditor";

function checkboxCalc(values: any[], type: CalculationType): any {
  const toBool = (v: any): boolean => v === true || v === 1 || v === "true";
  const checked = values.filter(toBool).length;
  const unchecked = values.length - checked;

  switch (type) {
    case "count":
      return values.length;
    case "count_checked":
      return checked;
    case "count_unchecked":
      return unchecked;
    case "percent_checked":
      return values.length === 0 ? 0 : (checked / values.length) * 100;
    case "count_empty":
      return unchecked;
    case "count_not_empty":
      return checked;
    case "percent_empty":
      return values.length === 0 ? 0 : (unchecked / values.length) * 100;
    case "percent_not_empty":
      return values.length === 0 ? 0 : (checked / values.length) * 100;
    default:
      return null;
  }
}

// Form input for checkbox is a simple toggle
function CheckboxFormInput({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  const checked = value === true || value === 1 || value === "true";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 items-center justify-center rounded border ${
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked && (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

export const CheckboxFieldType: FieldTypeDefinition = {
  key: "checkbox",
  label: "Checkbox",
  icon: CheckSquareIcon,
  group: "standard",

  hasTypeConfig: false,
  TypeConfigComponent: null,
  defaultTypeConfig: {},

  CellDisplay: CheckboxCellDisplay,
  KanbanDisplay: CheckboxCellDisplay,
  DetailDisplay: CheckboxCellDisplay,

  CellEditor: CheckboxCellEditor,
  KanbanEditor: CheckboxCellEditor,
  FormInput: CheckboxFormInput as any,
  DetailEditor: CheckboxCellEditor,

  editorStyle: "toggle",

  validate: () => ({ valid: true }),

  parseValue: (raw: any) => {
    if (raw == null || raw === "") return null;
    if (raw === true || raw === 1 || raw === "true") return true;
    return false;
  },
  serializeValue: (value: any) =>
    value == null ? null : value === true,
  getEmptyValue: () => false,
  isEmpty: (value: any) => value == null || value === "",
  formatDisplayValue: (value: any) => {
    return value === true || value === 1 || value === "true"
      ? "Checked"
      : "Unchecked";
  },

  comparator: (a: any, b: any) => {
    const ba = a === true || a === 1 || a === "true" ? 1 : 0;
    const bb = b === true || b === 1 || b === "true" ? 1 : 0;
    return ba - bb;
  },

  FilterComponent: null,
  filterOperators: [
    { key: "eq", label: "is checked", requiresValue: false },
    { key: "neq", label: "is not checked", requiresValue: false },
  ],

  availableCalculations: [
    "count",
    "count_checked",
    "count_unchecked",
    "percent_checked",
    "count_empty",
    "count_not_empty",
    "percent_empty",
    "percent_not_empty",
  ],
  calculate: checkboxCalc,

  placeholder: "",
};

export default CheckboxFieldType;
