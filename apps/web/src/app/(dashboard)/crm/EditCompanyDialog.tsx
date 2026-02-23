"use client";

import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Button,
  Input,
  Label,
  addToast,
} from "@basicsos/ui";
import { CustomFieldsEditor } from "./CustomFieldsEditor";

interface EditCompanyDialogProps {
  children: React.ReactNode;
  company: { id: string; name: string; domain: string | null; industry: string | null; customFields?: unknown };
  onUpdated?: () => void;
}

export const EditCompanyDialog = ({
  children,
  company,
  onUpdated,
}: EditCompanyDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company.name);
  const [domain, setDomain] = useState(company.domain ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    (company.customFields as Record<string, unknown>) ?? {},
  );

  useEffect(() => {
    if (open) {
      setName(company.name);
      setDomain(company.domain ?? "");
      setIndustry(company.industry ?? "");
      setCustomFields((company.customFields as Record<string, unknown>) ?? {});
    }
  }, [open, company]);

  const updateCompany = trpc.crm.companies.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Company updated", variant: "success" });
      setOpen(false);
      onUpdated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to update company", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!name.trim()) return;
    updateCompany.mutate({
      id: company.id,
      name: name.trim(),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-company-name">Name</Label>
            <Input id="edit-company-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-company-domain">Domain</Label>
            <Input id="edit-company-domain" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-company-industry">Industry</Label>
            <Input id="edit-company-industry" placeholder="Technology" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateCompany.isPending}>
              {updateCompany.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
