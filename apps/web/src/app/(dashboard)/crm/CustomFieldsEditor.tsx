"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Plus,
  X,
} from "@basicsos/ui";

type FieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi_select"
  | "url"
  | "phone";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[] | null;
  required?: boolean;
}

interface CustomFieldsEditorProps {
  value: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
  /** When provided, renders type-appropriate inputs per field definition. */
  fieldDefs?: FieldDef[];
}

// ---------------------------------------------------------------------------
// Typed field input — renders an appropriate control for each field type.
// ---------------------------------------------------------------------------

interface TypedFieldInputProps {
  def: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}

const TypedFieldInput = ({ def, value, onChange }: TypedFieldInputProps): JSX.Element => {
  const { type, options, key, label } = def;

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={`cf-${key}`}
          checked={Boolean(value)}
          onCheckedChange={onChange}
        />
        <Label htmlFor={`cf-${key}`} className="text-xs">
          {label}
        </Label>
      </div>
    );
  }

  if (type === "select") {
    const opts = options ?? [];
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
      >
        <SelectTrigger className="text-xs h-8">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === "multi_select") {
    const opts = options ?? [];
    const currentValues: string[] =
      Array.isArray(value) ? (value as string[]) : [];

    const toggle = (opt: string): void => {
      const next = currentValues.includes(opt)
        ? currentValues.filter((v) => v !== opt)
        : [...currentValues, opt];
      onChange(next);
    };

    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-md px-2 py-0.5 text-xs border transition-colors ${
              currentValues.includes(opt)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (type === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="flex-1 text-xs h-8"
      />
    );
  }

  if (type === "date") {
    return (
      <Input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-xs h-8"
      />
    );
  }

  // text | url | phone — all render as a text input
  return (
    <Input
      type="text"
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 text-xs h-8"
    />
  );
};

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export const CustomFieldsEditor = ({
  value,
  onChange,
  fieldDefs,
}: CustomFieldsEditorProps): JSX.Element => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // --- Typed mode: render inputs driven by field definitions ----------------
  if (fieldDefs && fieldDefs.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <Label>Custom Fields</Label>
        {fieldDefs.map((def) => (
          <div key={def.key} className="flex flex-col gap-1">
            {def.type !== "boolean" && (
              <Label htmlFor={`cf-${def.key}`} className="text-xs text-stone-500">
                {def.label}
                {def.required && <span className="ml-1 text-red-500">*</span>}
              </Label>
            )}
            <TypedFieldInput
              def={def}
              value={value[def.key]}
              onChange={(val) => onChange({ ...value, [def.key]: val })}
            />
          </div>
        ))}
      </div>
    );
  }

  // --- Generic mode: free-form key/value pairs ------------------------------

  const entries = Object.entries(value);

  const addField = (): void => {
    const key = newKey.trim();
    if (!key) return;
    onChange({ ...value, [key]: newValue });
    setNewKey("");
    setNewValue("");
  };

  const removeField = (key: string): void => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const updateFieldValue = (key: string, val: string): void => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Custom Fields</Label>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <Input value={key} disabled className="w-32 text-xs" />
          <Input
            value={String(val ?? "")}
            onChange={(e) => updateFieldValue(key, e.target.value)}
            className="flex-1 text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => removeField(key)}
          >
            <X size={14} />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="w-32 text-xs"
        />
        <Input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={addField}
          disabled={!newKey.trim()}
        >
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
};
