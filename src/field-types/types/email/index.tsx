import { EnvelopeIcon } from "@phosphor-icons/react";
import type { FieldTypeDefinition, CalculationType } from "@/field-types/types";
import { EmailCellDisplay } from "./EmailCellDisplay";
import { EmailCellEditor } from "./EmailCellEditor";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function countCalc(values: any[], type: CalculationType): any {
  const nonNull = values.filter((v) => v != null && v !== "");
  switch (type) {
    case "count":
      return values.length;
    case "count_empty":
      return values.length - nonNull.length;
    case "count_not_empty":
      return nonNull.length;
    case "percent_empty":
      return values.length === 0
        ? 0
        : ((values.length - nonNull.length) / values.length) * 100;
    case "percent_not_empty":
      return values.length === 0 ? 0 : (nonNull.length / values.length) * 100;
    default:
      return null;
  }
}

// Simple form input for email
function EmailFormInput({
  value,
  onChange,
  error,
}: {
  value: any;
  onChange: (v: any) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <input
        type="email"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="email@example.com"
        className={`border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${error ? "border-destructive" : ""}`}
      />
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export const EmailFieldType: FieldTypeDefinition = {
  key: "email",
  label: "Email",
  icon: EnvelopeIcon,
  group: "standard",

  hasTypeConfig: false,
  TypeConfigComponent: null,
  defaultTypeConfig: {},

  CellDisplay: EmailCellDisplay,
  KanbanDisplay: EmailCellDisplay,
  DetailDisplay: EmailCellDisplay,

  CellEditor: EmailCellEditor,
  KanbanEditor: EmailCellEditor,
  FormInput: EmailFormInput as any,
  DetailEditor: EmailCellEditor,

  editorStyle: "inline",

  validate: (value: any) => {
    if (value == null || value === "") return { valid: true };
    if (!EMAIL_REGEX.test(String(value))) {
      return { valid: false, message: "Invalid email address" };
    }
    return { valid: true };
  },

  parseValue: (raw: any) => (raw == null || raw === "" ? null : String(raw)),
  serializeValue: (value: any) => (value === "" ? null : value),
  getEmptyValue: () => null,
  isEmpty: (value: any) => value == null || value === "",
  formatDisplayValue: (value: any) =>
    value == null || value === "" ? "" : String(value),

  comparator: (a: any, b: any) => {
    const sa = a == null ? "" : String(a).toLowerCase();
    const sb = b == null ? "" : String(b).toLowerCase();
    return sa.localeCompare(sb);
  },

  FilterComponent: null,
  filterOperators: [
    { key: "like", label: "contains", requiresValue: true },
    { key: "eq", label: "is", requiresValue: true },
    { key: "neq", label: "is not", requiresValue: true },
    { key: "is_empty", label: "is empty", requiresValue: false },
    { key: "is_not_empty", label: "is not empty", requiresValue: false },
  ],

  availableCalculations: [
    "count",
    "count_empty",
    "count_not_empty",
    "percent_empty",
    "percent_not_empty",
  ],
  calculate: countCalc,

  placeholder: "email@example.com",
};

export default EmailFieldType;
