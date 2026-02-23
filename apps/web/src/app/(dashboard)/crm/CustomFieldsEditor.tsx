"use client";

import { useState } from "react";
import { Button, Input, Label } from "@basicsos/ui";
import { Plus, X } from "@basicsos/ui";

interface CustomFieldsEditorProps {
  value: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
}

export const CustomFieldsEditor = ({
  value,
  onChange,
}: CustomFieldsEditorProps): JSX.Element => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

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
