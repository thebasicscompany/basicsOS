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
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import { buildRecordWritePayload } from "@/lib/crm/field-utils";
import { useCreateRecord, useBulkCreateRecords } from "@/hooks/use-records";
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
  const [queue, setQueue] = useState<Record<string, unknown>[]>([]);

  const createRecord = useCreateRecord(objectSlug);
  const bulkCreate = useBulkCreateRecords(objectSlug);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(attributes));
      setErrors({});
      setQueue([]);
    }
  }, [open, attributes]);

  const visibleAttributes = useMemo(
    () => attributes.filter((a) => !a.isSystem && !a.isHiddenByDefault),
    [attributes],
  );

  const hasFormValues = useMemo(
    () =>
      visibleAttributes.some(
        (a) => !getFieldType(a.uiType).isEmpty(values[a.columnName]),
      ),
    [visibleAttributes, values],
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
    const payload = buildRecordWritePayload(attributes, values);

    if (createMore) {
      // Queue this record; the whole batch is sent in one bulk request.
      setQueue((q) => [...q, payload]);
      setValues(buildInitialValues(attributes));
      setErrors({});
      return;
    }

    try {
      const record = await createRecord.mutateAsync(payload);
      onCreated?.(record);
      onOpenChange(false);
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

  const handleCreateBatch = useCallback(async () => {
    // Fold in the current form if it has content (so the last row isn't lost).
    let batch = queue;
    const hasFormValues = visibleAttributes.some(
      (a) => !getFieldType(a.uiType).isEmpty(values[a.columnName]),
    );
    if (hasFormValues) {
      if (!validate()) return;
      batch = [...queue, buildRecordWritePayload(attributes, values)];
    }
    if (batch.length === 0) return;
    try {
      await bulkCreate.mutateAsync(batch);
      setQueue([]);
      setValues(buildInitialValues(attributes));
      setErrors({});
      onOpenChange(false);
    } catch {
      /* error surfaced via bulkCreate.error */
    }
  }, [
    queue,
    visibleAttributes,
    values,
    validate,
    attributes,
    bulkCreate,
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

        <ToggleGroup
          type="single"
          variant="outline"
          value={createMore ? "multiple" : "single"}
          onValueChange={(v) => {
            if (v) setCreateMore(v === "multiple");
          }}
          className="self-start"
        >
          <ToggleGroupItem value="single" className="h-8 gap-1.5 px-3 text-xs">
            <FileIcon className="size-3.5" />
            Create one
          </ToggleGroupItem>
          <ToggleGroupItem value="multiple" className="h-8 gap-1.5 px-3 text-xs">
            <CopySimpleIcon className="size-3.5" />
            Create many
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="max-h-[60vh] min-w-0 overflow-y-auto pr-1">
          <div ref={formRef} className="pb-2">
            <RecordForm
              attributes={attributes}
              values={values}
              onChange={handleChange}
              errors={errors}
            />
          </div>
        </div>

        {createRecord.error && (
          <p className="text-sm text-destructive">
            {(createRecord.error as Error).message ??
              "Failed to create record."}
          </p>
        )}

        <DialogFooter className="items-center gap-2">
          {createMore && queue.length > 0 && (
            <span className="mr-auto text-xs text-muted-foreground">
              {queue.length} queued
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRecord.isPending || bulkCreate.isPending}
          >
            Cancel
          </Button>
          {createMore ? (
            <>
              <Button
                variant="outline"
                onClick={handleSubmit}
                disabled={bulkCreate.isPending || !hasFormValues}
              >
                Add
              </Button>
              <Button
                onClick={handleCreateBatch}
                disabled={
                  bulkCreate.isPending || (queue.length === 0 && !hasFormValues)
                }
              >
                {bulkCreate.isPending
                  ? "Creating…"
                  : `Create ${queue.length + (hasFormValues ? 1 : 0)}`}
              </Button>
            </>
          ) : (
            <Button onClick={handleSubmit} disabled={createRecord.isPending}>
              {createRecord.isPending ? "Creating..." : `Create ${objectName}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
