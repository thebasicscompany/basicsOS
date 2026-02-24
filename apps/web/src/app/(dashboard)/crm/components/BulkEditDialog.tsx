"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  addToast,
} from "@basicsos/ui";
import { STAGES } from "../utils";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: "contact" | "company" | "deal";
  selectedIds: string[];
  onSuccess: () => void;
}

type ContactField = "email" | "phone" | "companyId";
type CompanyField = "industry" | "domain";
type DealField = "stage" | "value" | "probability";

type FieldOption = { label: string; value: string };

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: FieldOption[];
  placeholder?: string;
}

const CONTACT_FIELDS: FieldDef[] = [
  { key: "email", label: "Email", type: "text", placeholder: "new@example.com" },
  { key: "phone", label: "Phone", type: "text", placeholder: "+1 555 000 0000" },
];

const COMPANY_FIELDS: FieldDef[] = [
  { key: "industry", label: "Industry", type: "text", placeholder: "e.g. Software" },
  { key: "domain", label: "Domain", type: "text", placeholder: "e.g. acme.com" },
];

const DEAL_FIELDS: FieldDef[] = [
  {
    key: "stage",
    label: "Stage",
    type: "select",
    options: STAGES.map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
    })),
  },
  { key: "value", label: "Value ($)", type: "number", placeholder: "0" },
  { key: "probability", label: "Probability (%)", type: "number", placeholder: "50" },
];

export function BulkEditDialog({
  open,
  onOpenChange,
  entity,
  selectedIds,
  onSuccess,
}: BulkEditDialogProps): JSX.Element {
  const [selectedField, setSelectedField] = useState<string>("");
  const [textValue, setTextValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [numberValue, setNumberValue] = useState("");

  const contactBulkUpdate = trpc.crm.contacts.bulkUpdate.useMutation();
  const companyBulkUpdate = trpc.crm.companies.bulkUpdate.useMutation();
  const dealBulkUpdate = trpc.crm.deals.bulkUpdate.useMutation();

  const { data: companiesData } = trpc.crm.companies.list.useQuery();

  const contactFields: FieldDef[] = [
    ...CONTACT_FIELDS,
    {
      key: "companyId",
      label: "Company",
      type: "select",
      options: (companiesData ?? []).map((c) => ({ label: c.name, value: c.id })),
    },
  ];

  const fieldDefs: FieldDef[] =
    entity === "contact" ? contactFields
    : entity === "company" ? COMPANY_FIELDS
    : DEAL_FIELDS;

  const currentFieldDef = fieldDefs.find((f) => f.key === selectedField) ?? null;

  const isPending =
    contactBulkUpdate.isPending || companyBulkUpdate.isPending || dealBulkUpdate.isPending;

  const handleClose = (): void => {
    setSelectedField("");
    setTextValue("");
    setSelectValue("");
    setNumberValue("");
    onOpenChange(false);
  };

  const handleApply = (): void => {
    if (!currentFieldDef) return;

    const count = selectedIds.length;
    const label = `${count} ${entity}${count !== 1 ? "s" : ""}`;

    if (entity === "contact") {
      const field = selectedField as ContactField;
      const patchValue =
        currentFieldDef.type === "text" ? (textValue.trim() || null)
        : currentFieldDef.type === "select" ? (selectValue || null)
        : null;

      const patch: {
        name?: string;
        email?: string | null;
        phone?: string | null;
        companyId?: string | null;
      } =
        field === "email" ? { email: patchValue }
        : field === "phone" ? { phone: patchValue }
        : field === "companyId" ? { companyId: patchValue }
        : {};

      contactBulkUpdate.mutate(
        { ids: selectedIds, patch },
        {
          onSuccess: (data) => {
            addToast({ title: `Updated ${data.updated} of ${label}`, variant: "success" });
            onSuccess();
            handleClose();
          },
          onError: (err) => {
            addToast({ title: "Update failed", description: err.message, variant: "destructive" });
          },
        },
      );
      return;
    }

    if (entity === "company") {
      const field = selectedField as CompanyField;
      const patchValue =
        currentFieldDef.type === "text" ? (textValue.trim() || null) : null;

      const patch: { name?: string; domain?: string | null; industry?: string | null } =
        field === "industry" ? { industry: patchValue }
        : field === "domain" ? { domain: patchValue }
        : {};

      companyBulkUpdate.mutate(
        { ids: selectedIds, patch },
        {
          onSuccess: (data) => {
            addToast({ title: `Updated ${data.updated} of ${label}`, variant: "success" });
            onSuccess();
            handleClose();
          },
          onError: (err) => {
            addToast({ title: "Update failed", description: err.message, variant: "destructive" });
          },
        },
      );
      return;
    }

    if (entity === "deal") {
      const field = selectedField as DealField;
      const patch: { stage?: string | undefined; value?: string | undefined; probability?: number | undefined } =
        field === "stage" ? { stage: selectValue || undefined }
        : field === "value" ? { value: numberValue || undefined }
        : field === "probability" ? { probability: numberValue ? Number(numberValue) : undefined }
        : {};

      dealBulkUpdate.mutate(
        { ids: selectedIds, patch },
        {
          onSuccess: (data) => {
            addToast({ title: `Updated ${data.updated} of ${label}`, variant: "success" });
            onSuccess();
            handleClose();
          },
          onError: (err) => {
            addToast({ title: "Update failed", description: err.message, variant: "destructive" });
          },
        },
      );
    }
  };

  const canApply =
    !!currentFieldDef &&
    (currentFieldDef.type === "text"
      ? true
      : currentFieldDef.type === "select"
        ? !!selectValue
        : !!numberValue);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit {selectedIds.length} record{selectedIds.length !== 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Field</label>
            <Select value={selectedField} onValueChange={(v) => { setSelectedField(v); setTextValue(""); setSelectValue(""); setNumberValue(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field to edit..." />
              </SelectTrigger>
              <SelectContent>
                {fieldDefs.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentFieldDef && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                New value for {currentFieldDef.label}
              </label>
              {currentFieldDef.type === "text" && (
                <Input
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={currentFieldDef.placeholder ?? ""}
                />
              )}
              {currentFieldDef.type === "number" && (
                <Input
                  type="number"
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value)}
                  placeholder={currentFieldDef.placeholder ?? "0"}
                />
              )}
              {currentFieldDef.type === "select" && (
                <Select value={selectValue} onValueChange={setSelectValue}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${currentFieldDef.label}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(currentFieldDef.options ?? []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={!canApply || isPending}>
            {isPending ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
