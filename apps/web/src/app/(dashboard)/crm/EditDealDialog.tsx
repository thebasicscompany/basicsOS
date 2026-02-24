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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  addToast,
} from "@basicsos/ui";

import type { DealStage } from "./types";
import { CustomFieldsEditor } from "./CustomFieldsEditor";

interface EditDealDialogProps {
  children: React.ReactNode;
  deal: {
    id: string;
    title: string;
    stage: string;
    value: string | null;
    probability: number | null;
    companyId: string | null;
    contactId: string | null;
    customFields?: unknown;
  };
  onUpdated?: () => void;
}

export const EditDealDialog = ({ children, deal, onUpdated }: EditDealDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value ?? "0");
  const [stage, setStage] = useState<DealStage>(deal.stage as DealStage);
  const [probability, setProbability] = useState(String(deal.probability ?? 50));
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    (deal.customFields as Record<string, unknown>) ?? {},
  );

  useEffect(() => {
    if (open) {
      setTitle(deal.title);
      setValue(deal.value ?? "0");
      setStage(deal.stage as DealStage);
      setProbability(String(deal.probability ?? 50));
      setCustomFields((deal.customFields as Record<string, unknown>) ?? {});
    }
  }, [open, deal]);

  const { data: companiesList } = trpc.crm.companies.list.useQuery(undefined, { enabled: open });
  const { data: contactsList } = trpc.crm.contacts.list.useQuery({}, { enabled: open });
  const [companyId, setCompanyId] = useState(deal.companyId ?? "");
  const [contactId, setContactId] = useState(deal.contactId ?? "");

  useEffect(() => {
    if (open) {
      setCompanyId(deal.companyId ?? "");
      setContactId(deal.contactId ?? "");
    }
  }, [open, deal]);

  const updateDeal = trpc.crm.deals.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Deal updated", variant: "success" });
      setOpen(false);
      onUpdated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to update deal", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!title.trim()) return;
    updateDeal.mutate({
      id: deal.id,
      title: title.trim(),
      value: value || "0",
      probability: Number(probability) || 50,
      companyId: companyId || undefined,
      contactId: contactId || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-deal-title">Title</Label>
            <Input id="edit-deal-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-deal-value">Value ($)</Label>
              <Input id="edit-deal-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-deal-prob">Probability (%)</Label>
              <Input id="edit-deal-prob" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-deal-stage">Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
              <SelectTrigger id="edit-deal-stage"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Company</Label>
            <Select value={companyId || "__none__"} onValueChange={(v) => setCompanyId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {(companiesList ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Select value={contactId || "__none__"} onValueChange={(v) => setContactId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {(contactsList ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CustomFieldsEditor entity="deals" value={customFields} onChange={setCustomFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateDeal.isPending}>
              {updateDeal.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
