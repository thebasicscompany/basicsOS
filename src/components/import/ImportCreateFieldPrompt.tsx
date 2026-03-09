import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateColumn } from "@/hooks/use-columns";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

const SIMPLE_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "long-text", label: "Long Text" },
  { value: "number", label: "Number" },
];

export interface ImportCreateFieldPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvHeader: string;
  resource: string;
  onCreated: (name: string) => void;
}

export function ImportCreateFieldPrompt({
  open,
  onOpenChange,
  csvHeader,
  resource,
  onCreated,
}: ImportCreateFieldPromptProps) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const createColumn = useCreateColumn();

  useEffect(() => {
    if (open) {
      setLabel(csvHeader || "New field");
      setFieldType("text");
    }
  }, [open, csvHeader]);

  const handleSubmit = useCallback(async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Enter a field name");
      return;
    }
    try {
      await createColumn.mutateAsync({
        resource,
        title: trimmed,
        fieldType,
      });
      const name = trimmed.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      onCreated(name);
      onOpenChange(false);
    } catch (err) {
      showError(err, "Failed to create field");
    }
  }, [label, fieldType, resource, createColumn, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new field</DialogTitle>
          <DialogDescription>
            Add a custom field for &quot;{csvHeader}&quot; and map it to this
            column.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="import-field-label">Field name</Label>
            <Input
              id="import-field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Industry"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIMPLE_FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createColumn.isPending}>
            {createColumn.isPending ? "Creating..." : "Create & map"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
