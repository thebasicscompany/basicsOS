import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getFieldType } from "@/field-types";
import { useUpdateColumn } from "@/hooks/use-columns";
import { useUpsertAttributeOverride } from "@/hooks/use-object-registry";
import type { Attribute } from "@/types/objects";

export interface EditAttributeDialogProps {
  attribute: Attribute | null;
  objectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAttributeDialog({
  attribute,
  objectSlug,
  open,
  onOpenChange,
}: EditAttributeDialogProps) {
  const [label, setLabel] = useState("");
  const [columnName, setColumnName] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const updateColumn = useUpdateColumn();
  const upsertOverride = useUpsertAttributeOverride(objectSlug);

  const isCustom = attribute?.id.startsWith("custom_") ?? false;
  const isSaving = updateColumn.isPending || upsertOverride.isPending;

  useEffect(() => {
    if (attribute && open) {
      setLabel(attribute.name);
      setColumnName(attribute.columnName);
      setConfig(attribute.config ?? {});
    }
  }, [attribute, open]);

  if (!attribute) return null;

  const fieldType = getFieldType(attribute.uiType);
  const hasTypeConfig = fieldType.hasTypeConfig;
  const TypeConfigComponent = fieldType.TypeConfigComponent;
  const FieldIcon = fieldType.icon;

  const handleSave = async () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      toast.error("Display name cannot be empty");
      return;
    }

    try {
      if (isCustom) {
        const trimmedColumnName = columnName.trim();
        if (!trimmedColumnName) {
          toast.error("Column name cannot be empty");
          return;
        }
        await updateColumn.mutateAsync({
          columnId: attribute.id,
          name:
            trimmedColumnName !== attribute.columnName
              ? trimmedColumnName
              : undefined,
          label: trimmedLabel !== attribute.name ? trimmedLabel : undefined,
          options: config.options as
            | Array<
                | string
                | {
                    id: string;
                    label: string;
                    color?: string;
                    order?: number;
                    isTerminal?: boolean;
                  }
              >
            | undefined,
        });
      } else {
        await upsertOverride.mutateAsync({
          columnName: attribute.columnName,
          displayName:
            trimmedLabel !== attribute.name ? trimmedLabel : undefined,
          config: config,
        });
      }
      toast.success("Field updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update field");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {FieldIcon && (
              <FieldIcon className="size-4 text-muted-foreground" />
            )}
            {attribute.name}
          </DialogTitle>
          <DialogDescription>
            Configure this field. Changes apply across all views.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="attr-label"
              className="text-xs text-muted-foreground"
            >
              Display name
            </Label>
            <Input
              id="attr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="attr-colname"
              className="text-xs text-muted-foreground"
            >
              Column name
            </Label>
            {isCustom ? (
              <Input
                id="attr-colname"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            ) : (
              <Input
                value={attribute.columnName}
                disabled
                className="h-8 font-mono text-xs opacity-70"
              />
            )}
            {isCustom && columnName !== attribute.columnName && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Renaming the column will migrate existing data automatically.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Field type</Label>
            <Badge variant="outline" className="w-fit gap-1.5 py-1">
              {FieldIcon && <FieldIcon className="size-3.5" />}
              {fieldType.label}
            </Badge>
          </div>

          {hasTypeConfig && TypeConfigComponent && (
            <>
              <Separator />
              <TypeConfigComponent config={config} onChange={setConfig} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
