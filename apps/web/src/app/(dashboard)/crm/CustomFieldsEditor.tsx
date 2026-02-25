"use client";

import { trpc } from "@/lib/trpc";
import {
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@basicsos/ui";
import { normalizeOptions, getOptionColor } from "./utils";

interface CustomFieldsEditorProps {
  entity: "contacts" | "companies" | "deals";
  value: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
}

export const CustomFieldsEditor = ({
  entity,
  value,
  onChange,
}: CustomFieldsEditorProps): JSX.Element | null => {
  const { data: defs = [] } = trpc.crm.customFieldDefs.list.useQuery({ entity });

  if (defs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Custom Fields
      </Label>
      {defs.map((def) => {
        const currentValue = value[def.key];
        const options = normalizeOptions(def.options);

        if (def.type === "boolean") {
          return (
            <div key={def.key} className="flex items-center justify-between gap-2">
              <Label htmlFor={`cf-${def.key}`} className="text-sm cursor-pointer">
                {def.label}
              </Label>
              <Switch
                id={`cf-${def.key}`}
                checked={!!currentValue}
                onCheckedChange={(checked) => onChange({ ...value, [def.key]: checked })}
              />
            </div>
          );
        }

        if (def.type === "select") {
          return (
            <div key={def.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`cf-${def.key}`} className="text-sm">
                {def.label}
              </Label>
              <Select
                value={typeof currentValue === "string" && currentValue !== "" ? currentValue : "__none__"}
                onValueChange={(v) => onChange({ ...value, [def.key]: v === "__none__" ? "" : v })}
              >
                <SelectTrigger id={`cf-${def.key}`}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {options.map((opt) => {
                    const colors = getOptionColor(opt.color);
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-1.5">
                          <span className={cn("size-2 rounded-full", colors.dot)} />
                          {opt.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (def.type === "multi_select") {
          const selected = Array.isArray(currentValue) ? (currentValue as string[]) : [];
          return (
            <div key={def.key} className="flex flex-col gap-1.5">
              <Label className="text-sm">{def.label}</Label>
              <div className="flex flex-col gap-1">
                {options.map((opt) => {
                  const colors = getOptionColor(opt.color);
                  return (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Switch
                        id={`cf-${def.key}-${opt.value}`}
                        checked={selected.includes(opt.value)}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...selected, opt.value]
                            : selected.filter((s) => s !== opt.value);
                          onChange({ ...value, [def.key]: next });
                        }}
                      />
                      <Label htmlFor={`cf-${def.key}-${opt.value}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <span className={cn("size-2 rounded-full", colors.dot)} />
                        {opt.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        const inputType =
          def.type === "number"
            ? "number"
            : def.type === "date"
              ? "date"
              : "text";

        return (
          <div key={def.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`cf-${def.key}`} className="text-sm">
              {def.label}
            </Label>
            <Input
              id={`cf-${def.key}`}
              type={inputType}
              value={currentValue != null ? String(currentValue) : ""}
              onChange={(e) => onChange({ ...value, [def.key]: e.target.value })}
              placeholder={def.label}
            />
          </div>
        );
      })}
    </div>
  );
};
