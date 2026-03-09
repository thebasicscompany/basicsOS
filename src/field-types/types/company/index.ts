import { BuildingIcon } from "@phosphor-icons/react";
import type { FieldTypeDefinition } from "@/field-types/types";
import { CompanyCellDisplay } from "./CompanyCellDisplay";
import { CompanyCellEditor } from "./CompanyCellEditor";
import { CompanyFormInput } from "./CompanyFormInput";

export const CompanyFieldType: FieldTypeDefinition = {
  key: "company",
  label: "Company",
  icon: BuildingIcon,
  group: "relational",

  hasTypeConfig: false,
  TypeConfigComponent: null,
  defaultTypeConfig: {},

  CellDisplay: CompanyCellDisplay,
  KanbanDisplay: CompanyCellDisplay,
  DetailDisplay: CompanyCellDisplay,

  CellEditor: CompanyCellEditor,
  KanbanEditor: CompanyCellEditor,
  FormInput: CompanyFormInput,
  DetailEditor: CompanyCellEditor,

  editorStyle: "popover",

  validate: (value: unknown) => {
    if (value == null || value === "") return { valid: true };
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return { valid: true };
    return { valid: false, message: "Select a company" };
  },

  parseValue: (raw: unknown) => {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  },
  serializeValue: (value: unknown) => value,
  getEmptyValue: () => null,
  isEmpty: (value: unknown) =>
    value == null ||
    value === "" ||
    (typeof value === "number" && !Number.isInteger(value)),
  formatDisplayValue: (value: unknown) => {
    if (value == null || value === "") return "";
    if (typeof value === "object" && value !== null && "name" in value)
      return String((value as { name: string }).name);
    return String(value);
  },

  comparator: (a: unknown, b: unknown) => {
    const na = a == null ? -Infinity : Number(a);
    const nb = b == null ? -Infinity : Number(b);
    return na - nb;
  },

  FilterComponent: null,
  filterOperators: [
    { key: "eq", label: "is", requiresValue: true },
    { key: "is_empty", label: "is empty", requiresValue: false },
    { key: "is_not_empty", label: "is not empty", requiresValue: false },
  ],

  availableCalculations: [],
  calculate: () => null,

  placeholder: "Search companies...",
  searchPlaceholder: "Search by name, category...",
};

export default CompanyFieldType;
