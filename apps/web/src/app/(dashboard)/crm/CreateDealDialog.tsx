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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  addToast,
  FieldError,
} from "@basicsos/ui";

import type { DealStage } from "./types";

interface CreateDealDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export const CreateDealDialog = ({ children, onCreated }: CreateDealDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [companyId, setCompanyId] = useState("none");
  const [contactId, setContactId] = useState("none");
  const [titleError, setTitleError] = useState("");

  const { data: companiesList } = trpc.crm.companies.list.useQuery(undefined, { enabled: open });
  const { data: contactsList } = trpc.crm.contacts.list.useQuery({}, { enabled: open });

  const createDeal = trpc.crm.deals.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Deal created", variant: "success" });
      setOpen(false);
      setTitle("");
      setValue("");
      setStage("lead");
      setCompanyId("none");
      setContactId("none");
      setTitleError("");
      onCreated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to create deal", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setTitleError("");
    createDeal.mutate({
      title: title.trim(),
      value: value || "0",
      stage,
      companyId: companyId === "none" ? undefined : companyId,
      contactId: contactId === "none" ? undefined : contactId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTitleError(""); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-title">Title</Label>
            <Input id="deal-title" placeholder="Deal name" value={title} onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(""); }} autoFocus />
            <FieldError message={titleError} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-value">Value ($)</Label>
            <Input id="deal-value" type="number" min="0" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deal-stage">Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
              <SelectTrigger id="deal-stage"><SelectValue /></SelectTrigger>
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
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(companiesList ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(contactsList ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? "Creating..." : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
