import { PlusIcon } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestColumnMapping, type ParsedCSV } from "./import-utils";
import { ImportCreateFieldPrompt } from "./ImportCreateFieldPrompt";
import type { ColumnMapping } from "@/hooks/use-import";
import { useAttributes } from "@/hooks/use-object-registry";

const SKIP_VALUE = "__skip__";

const OBJECT_LABELS: Record<string, string> = {
  contacts: "contact",
  companies: "company",
  deals: "deal",
};

/** Standard fields per object (camelCase for API) */
const CONTACT_TARGET_COLUMNS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
];

const COMPANY_TARGET_COLUMNS = [
  { value: "name", label: "Company Name" },
  { value: "domain", label: "Domain" },
  { value: "description", label: "Description" },
  { value: "category", label: "Category" },
];

const DEAL_TARGET_COLUMNS = [
  { value: "name", label: "Deal Name" },
  { value: "status", label: "Status" },
  { value: "amount", label: "Amount" },
];

function getStandardColumnsForObject(
  objectSlug: string,
): Array<{ value: string; label: string }> {
  switch (objectSlug) {
    case "contacts":
      return CONTACT_TARGET_COLUMNS;
    case "companies":
      return COMPANY_TARGET_COLUMNS;
    case "deals":
      return DEAL_TARGET_COLUMNS;
    default:
      return CONTACT_TARGET_COLUMNS;
  }
}

export interface ImportColumnMapperProps {
  parsed: ParsedCSV;
  objectSlug: string;
  mapping: ColumnMapping;
  customFieldNames: Set<string>;
  onMappingChange: (mapping: ColumnMapping) => void;
  onAddCustomField: (name: string) => void;
  onNext: () => void;
}

export function ImportColumnMapper({
  parsed,
  objectSlug,
  mapping,
  customFieldNames: _customFieldNames,
  onMappingChange,
  onAddCustomField,
  onNext,
}: ImportColumnMapperProps) {
  const attributes = useAttributes(objectSlug);
  const [createFieldFor, setCreateFieldFor] = useState<{
    header: string;
    index: number;
  } | null>(null);

  const customColumns = useMemo(
    () =>
      attributes
        .filter((a) => a.id.startsWith("custom_"))
        .map((a) => ({ value: a.columnName, label: a.name })),
    [attributes],
  );

  const allTargetOptions = useMemo(
    () => [
      ...getStandardColumnsForObject(objectSlug),
      ...customColumns,
      { value: SKIP_VALUE, label: "Don't import" },
    ],
    [objectSlug, customColumns],
  );

  const getTargetForHeaderIndex = useCallback(
    (idx: number) => {
      for (const [target, i] of Object.entries(mapping)) {
        if (i === idx) return target;
      }
      return null;
    },
    [mapping],
  );

  const setHeaderMapping = useCallback(
    (headerIndex: number, targetValue: string) => {
      if (targetValue === "__create__") return;
      if (targetValue === SKIP_VALUE) {
        const next = { ...mapping };
        for (const [t, i] of Object.entries(next)) {
          if (i === headerIndex) delete next[t];
        }
        onMappingChange(next);
        return;
      }
      const next = { ...mapping };
      for (const [t, i] of Object.entries(next)) {
        if (i === headerIndex && t !== targetValue) delete next[t];
      }
      next[targetValue] = headerIndex;
      onMappingChange(next);
    },
    [mapping, onMappingChange],
  );

  const getSuggested = useCallback(
    (header: string) => suggestColumnMapping(header, objectSlug),
    [objectSlug],
  );

  const handleCreatedField = useCallback(
    (name: string) => {
      onAddCustomField(name);
      if (createFieldFor) {
        const next = { ...mapping };
        next[name] = createFieldFor.index;
        onMappingChange(next);
      }
      setCreateFieldFor(null);
    },
    [onAddCustomField, createFieldFor, mapping, onMappingChange],
  );

  const canProceed = useMemo(() => {
    return Object.keys(mapping).length > 0;
  }, [mapping]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted-foreground">
        Map each CSV column to a {OBJECT_LABELS[objectSlug] ?? "record"} field.
        Unmapped columns can be used to create new custom fields.
      </p>
      <div className="space-y-3">
        {parsed.headers.map((header, idx) => (
          <div
            key={`${header}-${idx}`}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            <Label className="min-w-[140px] text-[13px] font-medium">
              {header}
            </Label>
            <Select
              value={
                getTargetForHeaderIndex(idx) ??
                getSuggested(header) ??
                SKIP_VALUE
              }
              onValueChange={(v) => {
                if (v === "__create__") {
                  setCreateFieldFor({ header, index: idx });
                  return;
                }
                setHeaderMapping(idx, v);
              }}
            >
              <SelectTrigger className="flex-1 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTargetOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                <SelectItem value="__create__">Create new field...</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setCreateFieldFor({ header, index: idx })}
            >
              <PlusIcon className="size-3.5" />
              New
            </Button>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2">
        <span className="text-[12px] text-muted-foreground">
          {parsed.rows.length} rows • {Object.keys(mapping).length} columns
          mapped
        </span>
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
      <ImportCreateFieldPrompt
        open={createFieldFor !== null}
        onOpenChange={(open) => !open && setCreateFieldFor(null)}
        csvHeader={createFieldFor?.header ?? ""}
        resource={objectSlug}
        onCreated={handleCreatedField}
      />
    </div>
  );
}
