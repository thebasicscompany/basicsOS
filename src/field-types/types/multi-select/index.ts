import { ListIcon } from "@phosphor-icons/react";
import type {
  FieldTypeDefinition,
  CalculationType,
  SelectOption,
} from "@/field-types/types";
import { MultiSelectCellDisplay } from "./MultiSelectCellDisplay";
import { MultiSelectCellEditor } from "./MultiSelectCellEditor";
import { MultiSelectFormInput } from "./MultiSelectFormInput";
import { SelectTypeConfig } from "../select/SelectTypeConfig";

function multiSelectCalc(values: any[], type: CalculationType): any {
  const toArray = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [];
  };
  const nonEmpty = values.filter((v) => toArray(v).length > 0);

  switch (type) {
    case "count":
      return values.length;
    case "count_empty":
      return values.length - nonEmpty.length;
    case "count_not_empty":
      return nonEmpty.length;
    case "percent_empty":
      return values.length === 0
        ? 0
        : ((values.length - nonEmpty.length) / values.length) * 100;
    case "percent_not_empty":
      return values.length === 0 ? 0 : (nonEmpty.length / values.length) * 100;
    case "count_values": {
      const counts: Record<string, number> = {};
      for (const v of values) {
        for (const item of toArray(v)) {
          counts[item] = (counts[item] ?? 0) + 1;
        }
      }
      return counts;
    }
    case "percent_values": {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const v of values) {
        for (const item of toArray(v)) {
          counts[item] = (counts[item] ?? 0) + 1;
          total++;
        }
      }
      const percents: Record<string, number> = {};
      for (const [key, count] of Object.entries(counts)) {
        percents[key] = total === 0 ? 0 : (count / total) * 100;
      }
      return percents;
    }
    default:
      return null;
  }
}

export const MultiSelectFieldType: FieldTypeDefinition = {
  key: "multi-select",
  label: "Multi Select",
  icon: ListIcon,
  group: "standard",

  hasTypeConfig: true,
  TypeConfigComponent: SelectTypeConfig,
  defaultTypeConfig: { options: [] as SelectOption[] },

  CellDisplay: MultiSelectCellDisplay,
  KanbanDisplay: MultiSelectCellDisplay,
  DetailDisplay: MultiSelectCellDisplay,

  CellEditor: MultiSelectCellEditor,
  KanbanEditor: MultiSelectCellEditor,
  FormInput: MultiSelectFormInput,
  DetailEditor: MultiSelectCellEditor,

  editorStyle: "expanding",

  validate: (value: any, config: Record<string, any>) => {
    if (value == null || (Array.isArray(value) && value.length === 0))
      return { valid: true };
    const items: string[] = Array.isArray(value) ? value : [String(value)];
    const options: SelectOption[] = config.options ?? [];
    for (const item of items) {
      const found = options.some((o) => o.id === item || o.label === item);
      if (!found) return { valid: false, message: `Invalid option: ${item}` };
    }
    return { valid: true };
  },

  parseValue: (raw: any) => {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string")
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [];
  },
  serializeValue: (value: any) => {
    if (Array.isArray(value) && value.length === 0) return null;
    return value;
  },
  getEmptyValue: () => [],
  isEmpty: (value: any) =>
    value == null || (Array.isArray(value) && value.length === 0),
  formatDisplayValue: (value: any, config: Record<string, any>) => {
    const items: string[] = Array.isArray(value) ? value : [];
    const options: SelectOption[] = config.options ?? [];
    return items
      .map((item) => {
        const opt = options.find((o) => o.id === item || o.label === item);
        return opt?.label ?? item;
      })
      .join(", ");
  },

  comparator: (a: any, b: any) => {
    const la = Array.isArray(a) ? a.length : 0;
    const lb = Array.isArray(b) ? b.length : 0;
    return la - lb;
  },

  FilterComponent: null,
  filterOperators: [
    { key: "contains", label: "contains", requiresValue: true },
    { key: "not_contains", label: "does not contain", requiresValue: true },
    { key: "is_empty", label: "is empty", requiresValue: false },
    { key: "is_not_empty", label: "is not empty", requiresValue: false },
  ],

  availableCalculations: [
    "count",
    "count_empty",
    "count_not_empty",
    "percent_empty",
    "percent_not_empty",
    "count_values",
    "percent_values",
  ],
  calculate: multiSelectCalc,

  placeholder: "Select options...",
  searchPlaceholder: "Search options...",
};

export default MultiSelectFieldType;
