import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BuildingIcon,
  UserIcon,
  HandshakeIcon,
  BriefcaseIcon,
  ListChecksIcon,
  UsersIcon,
  ReceiptIcon,
  CalendarIcon,
  ShoppingBagIcon,
  PaperclipIcon,
  NotebookIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { fetchApi } from "@/lib/api";

const ICON_OPTIONS = [
  { value: "building-2", label: "Building", Icon: BuildingIcon },
  { value: "user", label: "Person", Icon: UserIcon },
  { value: "users", label: "People", Icon: UsersIcon },
  { value: "handshake", label: "Handshake", Icon: HandshakeIcon },
  { value: "briefcase", label: "Briefcase", Icon: BriefcaseIcon },
  { value: "checklist", label: "Checklist", Icon: ListChecksIcon },
  { value: "invoice", label: "Invoice", Icon: ReceiptIcon },
  { value: "calendar", label: "Calendar", Icon: CalendarIcon },
  { value: "shopping-bag", label: "Shopping", Icon: ShoppingBagIcon },
  { value: "attachment", label: "Attachment", Icon: PaperclipIcon },
  { value: "notebook", label: "Notebook", Icon: NotebookIcon },
] as const;

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "long-text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "domain", label: "URL / Domain" },
  { value: "location", label: "Location" },
  { value: "rating", label: "Rating" },
] as const;

interface FieldDef {
  id: string;
  label: string;
  fieldType: string;
}

export interface CreateObjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateObjectModal({
  open,
  onOpenChange,
}: CreateObjectModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [singularName, setSingularName] = useState("");
  const [pluralName, setPluralName] = useState("");
  const [icon, setIcon] = useState("building-2");
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setSingularName("");
    setPluralName("");
    setIcon("building-2");
    setFields([]);
  }, []);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const addField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", fieldType: "text" },
    ]);
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateField = useCallback(
    (id: string, key: keyof FieldDef, value: string) => {
      setFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, [key]: value } : f)),
      );
    },
    [],
  );

  const handleSingularChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSingularName(val);
      // Auto-derive plural (simple "s" suffix) only if user hasn't manually edited it
      if (!pluralName || pluralName === singularName + "s") {
        setPluralName(val ? val + "s" : "");
      }
    },
    [pluralName, singularName],
  );

  const handleSubmit = useCallback(async () => {
    if (!singularName.trim() || !pluralName.trim()) {
      toast.error("Object name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        singularName: singularName.trim(),
        pluralName: pluralName.trim(),
        icon,
        fields: fields
          .filter((f) => f.label.trim())
          .map((f) => ({
            name: f.label
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_|_$/g, ""),
            label: f.label.trim(),
            fieldType: f.fieldType,
          })),
      };
      const created = await fetchApi<{ slug: string }>(
        "/api/object-config",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["object-config"] });
      toast.success(`${singularName} object created`);
      handleOpenChange(false);
      navigate(`/objects/${created.slug}`);
    } catch (err) {
      toast.error(
        (err as Error).message || "Failed to create object",
      );
    } finally {
      setSubmitting(false);
    }
  }, [singularName, pluralName, icon, fields, queryClient, handleOpenChange, navigate]);

  const SelectedIcon =
    ICON_OPTIONS.find((o) => o.value === icon)?.Icon ?? BuildingIcon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Object</DialogTitle>
          <DialogDescription>
            Define a new object type with custom fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name + Icon row */}
          <div className="flex gap-3">
            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="w-[52px] h-9">
                  <SelectedIcon className="size-4" />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.Icon className="size-4" />
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Names */}
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="singular-name">Singular Name</Label>
              <Input
                id="singular-name"
                placeholder="e.g. Product"
                value={singularName}
                onChange={handleSingularChange}
                autoFocus
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="plural-name">Plural Name</Label>
              <Input
                id="plural-name"
                placeholder="e.g. Products"
                value={pluralName}
                onChange={(e) => setPluralName(e.target.value)}
              />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={addField}
              >
                <PlusIcon className="size-3.5 mr-1" />
                Add Field
              </Button>
            </div>

            {/* Built-in name field */}
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="flex-1">Name</span>
              <span className="text-xs">Text (built-in)</span>
            </div>

            {fields.map((field) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Field label"
                    value={field.label}
                    onChange={(e) =>
                      updateField(field.id, "label", e.target.value)
                    }
                  />
                </div>
                <Select
                  value={field.fieldType}
                  onValueChange={(v) =>
                    updateField(field.id, "fieldType", v)
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeField(field.id)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Object"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
