"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  EmptyState,
  PageHeader,
  SectionLabel,
  addToast,
  cn,
  Trash2,
  Edit3,
  Plus,
  Hash,
  X,
} from "@basicsos/ui";
import { OPTION_COLORS, normalizeOptions } from "../../utils";
import type { SelectOption } from "../../utils";

type EntityType = "contacts" | "companies" | "deals";

type FieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multi_select"
  | "url"
  | "phone";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Boolean",
  select: "Select",
  multi_select: "Multi-Select",
  url: "URL",
  phone: "Phone",
};

const FIELD_TYPE_BADGE_VARIANT: Record<
  FieldType,
  "default" | "secondary" | "outline"
> = {
  text: "secondary",
  number: "secondary",
  date: "secondary",
  boolean: "secondary",
  select: "outline",
  multi_select: "outline",
  url: "secondary",
  phone: "secondary",
};

interface FieldDefFormState {
  id?: string;
  key: string;
  label: string;
  type: FieldType;
  options: SelectOption[];
  required: boolean;
  position: number;
}

const DEFAULT_FORM: FieldDefFormState = {
  key: "",
  label: "",
  type: "text",
  options: [],
  required: false,
  position: 0,
};

function needsOptions(type: FieldType): boolean {
  return type === "select" || type === "multi_select";
}

interface FieldListProps {
  entity: EntityType;
}

const FieldList = ({ entity }: FieldListProps): JSX.Element => {
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FieldDefFormState>(DEFAULT_FORM);

  const { data: defs, isLoading } = trpc.crm.customFieldDefs.list.useQuery({
    entity,
  });

  const createMutation = trpc.crm.customFieldDefs.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Field created", variant: "success" });
      setDialogOpen(false);
      setForm(DEFAULT_FORM);
      void utils.crm.customFieldDefs.list.invalidate({ entity });
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.crm.customFieldDefs.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Field updated", variant: "success" });
      setDialogOpen(false);
      setForm(DEFAULT_FORM);
      void utils.crm.customFieldDefs.list.invalidate({ entity });
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.crm.customFieldDefs.delete.useMutation({
    onSuccess: () => {
      addToast({ title: "Field deleted", variant: "success" });
      setDeleteId(null);
      void utils.crm.customFieldDefs.list.invalidate({ entity });
    },
    onError: (err) => {
      addToast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = (): void => {
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (def: NonNullable<typeof defs>[number]): void => {
    setForm({
      id: def.id,
      key: def.key,
      label: def.label,
      type: def.type as FieldType,
      options: normalizeOptions(def.options),
      required: def.required,
      position: def.position,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (): void => {
    const opts = needsOptions(form.type) && form.options.length > 0
      ? form.options.filter((o) => o.label.trim() !== "")
      : undefined;
    if (form.id) {
      updateMutation.mutate({
        id: form.id,
        label: form.label,
        options: opts,
        required: form.required,
        position: form.position,
      });
    } else {
      createMutation.mutate({
        entity,
        key: form.key,
        label: form.label,
        type: form.type,
        options: opts,
        required: form.required,
        position: form.position,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {isLoading
            ? "Loading…"
            : `${defs?.length ?? 0} field${(defs?.length ?? 0) === 1 ? "" : "s"} defined`}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" />
          Add Field
        </Button>
      </div>

      {!isLoading && (defs ?? []).length === 0 && (
        <EmptyState
          Icon={Hash}
          heading="No custom fields"
          description="Add typed fields to capture structured data on your records."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1" />
              Add Field
            </Button>
          }
        />
      )}

      {(defs ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          {(defs ?? []).map((def) => (
            <Card key={def.id}>
              <CardContent className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant={FIELD_TYPE_BADGE_VARIANT[def.type as FieldType] ?? "secondary"}
                    className="shrink-0 font-mono text-[10px]"
                  >
                    {FIELD_TYPE_LABELS[def.type as FieldType] ?? def.type}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                      {def.label}
                    </p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400 font-mono">
                      {def.key}
                      {def.required && (
                        <span className="ml-1.5 text-red-500">required</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openEdit(def)}
                    aria-label="Edit field"
                  >
                    <Edit3 size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(def.id)}
                    aria-label="Delete field"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Field" : "Add Field"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Update the label, options, or constraints for this field."
                : "Define a new typed custom field for this entity."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {!form.id && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-key">Key</Label>
                <Input
                  id="field-key"
                  placeholder="e.g. lead_source"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                />
                <p className="text-xs text-stone-500">
                  Lowercase letters and underscores only. Cannot be changed later.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-label">Label</Label>
              <Input
                id="field-label"
                placeholder="e.g. Lead Source"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            {!form.id && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="field-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as FieldType }))}
                >
                  <SelectTrigger id="field-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {FIELD_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsOptions(form.type) && (
              <div className="flex flex-col gap-1.5">
                <Label>Options</Label>
                <div className="flex flex-col gap-2 rounded-md border border-stone-200 p-2 dark:border-stone-700">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        autoFocus={idx === form.options.length - 1}
                        placeholder="Option label..."
                        value={opt.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setForm((f) => ({
                            ...f,
                            options: f.options.map((o, i) =>
                              i === idx
                                ? { ...o, label, value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") }
                                : o,
                            ),
                          }));
                        }}
                        className="h-7 flex-1 text-xs"
                      />
                      <div className="flex items-center gap-0.5">
                        {OPTION_COLORS.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              setForm((f) => ({
                                ...f,
                                options: f.options.map((o, i) =>
                                  i === idx ? { ...o, color: c.name } : o,
                                ),
                              }));
                            }}
                            className={cn(
                              "size-4 rounded-full transition-all",
                              c.dot,
                              opt.color === c.name
                                ? "ring-2 ring-stone-400 ring-offset-1 dark:ring-stone-500"
                                : "opacity-60 hover:opacity-100",
                            )}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.filter((_, i) => i !== idx),
                          }))
                        }
                        className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        options: [
                          ...f.options,
                          {
                            label: "",
                            value: "",
                            color: OPTION_COLORS[f.options.length % OPTION_COLORS.length]!.name,
                          },
                        ],
                      }))
                    }
                  >
                    <Plus size={14} className="mr-1" />
                    Add option
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-position">Position</Label>
              <Input
                id="field-position"
                type="number"
                value={String(form.position)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, position: parseInt(e.target.value, 10) || 0 }))
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="field-required"
                checked={form.required}
                onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
              />
              <Label htmlFor="field-required">Required field</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving…" : form.id ? "Save Changes" : "Create Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this field? Existing data stored under
              this key will remain in records but will no longer be displayed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CustomFieldsSettingsPage = (): JSX.Element => {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Custom Fields" backHref="/crm" backLabel="CRM" />

      <div className="flex flex-col gap-2">
        <SectionLabel>Entity</SectionLabel>
        <p className="text-sm text-stone-500">
          Define typed custom fields per entity. Admins can create, edit, and delete field
          definitions.
        </p>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <FieldList entity="contacts" />
        </TabsContent>

        <TabsContent value="companies" className="mt-4">
          <FieldList entity="companies" />
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <FieldList entity="deals" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomFieldsSettingsPage;
