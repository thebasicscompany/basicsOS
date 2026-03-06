import { PhoneIcon } from "@phosphor-icons/react";
import type { FieldTypeDefinition, CalculationType } from "@/field-types/types";
import { PhoneCellDisplay } from "./PhoneCellDisplay";
import { PhoneCellEditor } from "./PhoneCellEditor";

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

function PhoneFormInput({
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
        type="tel"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="(555) 123-4567"
        className={`border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${error ? "border-destructive" : ""}`}
      />
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length > 10) return `+${digits}`;
  return raw;
}

export const PhoneFieldType: FieldTypeDefinition = {
  key: "phone",
  label: "Phone",
  icon: PhoneIcon,
  group: "standard",

  hasTypeConfig: false,
  TypeConfigComponent: null,
  defaultTypeConfig: {},

  CellDisplay: PhoneCellDisplay,
  KanbanDisplay: PhoneCellDisplay,
  DetailDisplay: PhoneCellDisplay,

  CellEditor: PhoneCellEditor,
  KanbanEditor: PhoneCellEditor,
  FormInput: PhoneFormInput as any,
  DetailEditor: PhoneCellEditor,

  editorStyle: "inline",

  validate: (value: any) => {
    if (value == null || value === "") return { valid: true };
    const digits = String(value).replace(/\D/g, "");
    if (digits.length < 7)
      return { valid: false, message: "Phone number too short" };
    return { valid: true };
  },

  parseValue: (raw: any) => (raw == null || raw === "" ? null : String(raw)),
  serializeValue: (value: any) => (value === "" ? null : value),
  getEmptyValue: () => null,
  isEmpty: (value: any) => value == null || value === "",
  formatDisplayValue: (value: any) => {
    if (value == null || value === "") return "";
    return formatPhone(String(value));
  },

  comparator: (a: any, b: any) => {
    const sa = a == null ? "" : String(a).replace(/\D/g, "");
    const sb = b == null ? "" : String(b).replace(/\D/g, "");
    return sa.localeCompare(sb);
  },

  FilterComponent: null,
  filterOperators: [
    { key: "like", label: "contains", requiresValue: true },
    { key: "eq", label: "is", requiresValue: true },
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

  placeholder: "(555) 123-4567",
};

export default PhoneFieldType;
