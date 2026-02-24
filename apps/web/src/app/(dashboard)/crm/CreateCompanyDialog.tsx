"use client";

import { useState } from "react";
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
  FieldError,
} from "@basicsos/ui";

interface CreateCompanyDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export const CreateCompanyDialog = ({
  children,
  onCreated,
}: CreateCompanyDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [nameError, setNameError] = useState("");

  const createCompany = trpc.crm.companies.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Company created", variant: "success" });
      setOpen(false);
      setName("");
      setDomain("");
      setIndustry("");
      setNameError("");
      onCreated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to create company", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setNameError("");
    createCompany.mutate({
      name: name.trim(),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNameError(""); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New Company</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-name">Name</Label>
            <Input id="company-name" placeholder="Company name" value={name} onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }} autoFocus />
            <FieldError message={nameError} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-domain">Domain</Label>
            <Input id="company-domain" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company-industry">Industry</Label>
            <Input id="company-industry" placeholder="Technology" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
