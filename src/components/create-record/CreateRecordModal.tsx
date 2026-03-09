/**
 * CreateRecordModal — dialog for creating new records.
 *
 * Features:
 *  - Dynamic form driven by Attribute array (via RecordForm)
 *  - Validates all fields before submission
 *  - "Create more" toggle: keep modal open and clear form after creation
 *  - Cmd+Enter keyboard shortcut to submit
 *  - Loading state during API call
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FileIcon, CopySimpleIcon } from "@phosphor-icons/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import { buildRecordWritePayload } from "@/lib/crm/field-utils";
import { useCreateRecord } from "@/hooks/use-records";
import { RecordForm } from "./RecordForm";

export interface CreateRecordModalProps {
  objectSlug: string;
  objectName: string;
  attributes: Attribute[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (record: any) => void;
}

function buildInitialValues(attributes: Attribute[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const attr of attributes) {
    if (attr.isSystem || attr.isHiddenByDefault) continue;
    values[attr.columnName] = undefined;
  }
  return values;
}

export function CreateRecordModal({
  objectSlug,
  objectName,
  attributes,
  open,
  onOpenChange,
  onCreated,
}: CreateRecordModalProps) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    buildInitialValues(attributes),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createMore, setCreateMore] = useState(false);

  const createRecord = useCreateRecord(objectSlug);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(attributes));
      setErrors({});
    }
  }, [open, attributes]);

  const visibleAttributes = useMemo(
    () => attributes.filter((a) => !a.isSystem && !a.isHiddenByDefault),
    [attributes],
  );

  const handleChange = useCallback((fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    for (const attr of visibleAttributes) {
      const fieldType = getFieldType(attr.uiType);
      const result = fieldType.validate(values[attr.columnName], attr.config);

      if (!result.valid) {
        newErrors[attr.columnName] = result.message ?? "Invalid value";
      }

      if (
        (attr.isPrimary || attr.isRequired) &&
        fieldType.isEmpty(values[attr.columnName])
      ) {
        newErrors[attr.columnName] = `${attr.name} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleAttributes, values]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    try {
      const payload = buildRecordWritePayload(attributes, values);
      const record = await createRecord.mutateAsync(payload);
      onCreated?.(record);

      if (createMore) {
        // Clear form for next entry
        setValues(buildInitialValues(attributes));
        setErrors({});
      } else {
        onOpenChange(false);
      }
    } catch {
      /* Form submit error handled by createRecord mutation state */
    }
  }, [
    validate,
    values,
    createRecord,
    onCreated,
    createMore,
    attributes,
    onOpenChange,
  ]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create {objectName}</DialogTitle>
          <DialogDescription>
            Fill in the fields below to create a new {objectName.toLowerCase()}.
            Required fields are marked with{" "}
            <span className="text-destructive">*</span>.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div ref={formRef} className="pb-6">
            <RecordForm
              attributes={attributes}
              values={values}
              onChange={handleChange}
              errors={errors}
            />
          </div>
        </ScrollArea>

        {createRecord.error && (
          <p className="text-sm text-destructive">
            {(createRecord.error as Error).message ??
              "Failed to create record."}
          </p>
        )}

        <DialogFooter className="items-center gap-4">
          <ToggleGroup
            type="single"
            variant="outline"
            value={createMore ? "multiple" : "single"}
            onValueChange={(v) => {
              if (v) setCreateMore(v === "multiple");
            }}
            className="mr-auto"
          >
            <ToggleGroupItem
              value="single"
              className="text-xs px-3 h-8 gap-1.5"
            >
              <FileIcon className="size-3.5" />
              Create one
            </ToggleGroupItem>
            <ToggleGroupItem
              value="multiple"
              className="text-xs px-3 h-8 gap-1.5"
            >
              <CopySimpleIcon className="size-3.5" />
              Create many
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRecord.isPending}
          >
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={createRecord.isPending}>
            {createRecord.isPending ? "Creating..." : `Create ${objectName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
