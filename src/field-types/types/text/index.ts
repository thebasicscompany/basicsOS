import { TextAaIcon } from "@phosphor-icons/react";
import type { FieldTypeDefinition, CalculationType } from "@/field-types/types";
import { TextCellDisplay } from "./TextCellDisplay";
import { TextCellEditor } from "./TextCellEditor";
import { TextFormInput } from "./TextFormInput";
import { TextDetailEditor } from "./TextDetailEditor";

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

export const TextFieldType: FieldTypeDefinition = {
  key: "text",
  label: "Text",
  icon: TextAaIcon,
  group: "standard",

  hasTypeConfig: false,
  TypeConfigComponent: null,
  defaultTypeConfig: {},

  CellDisplay: TextCellDisplay,
  KanbanDisplay: TextCellDisplay,
  DetailDisplay: TextCellDisplay,

  CellEditor: TextCellEditor,
  KanbanEditor: TextCellEditor,
  FormInput: TextFormInput,
  DetailEditor: TextDetailEditor,

  editorStyle: "inline",

  validate: (value: any) => {
    if (value != null && typeof value !== "string") {
      return { valid: false, message: "Value must be a string" };
    }
    return { valid: true };
  },

  parseValue: (raw: any) => (raw == null ? "" : String(raw)),
  serializeValue: (value: any) => (value === "" ? null : value),
  getEmptyValue: () => "",
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
    { key: "nlike", label: "does not contain", requiresValue: true },
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

  placeholder: "Set a value...",
};

export default TextFieldType;
