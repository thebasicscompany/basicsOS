"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { addToast, Sparkles } from "@basicsos/ui";
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
} from "@basicsos/ui";

interface CreateContactDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export const CreateContactDialog = ({
  children,
  onCreated,
}: CreateContactDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);

  const { data: companiesData } = trpc.crm.companies.list.useQuery(undefined, { enabled: open });

  const emailDomain = email.includes("@") ? email.split("@")[1] : undefined;
  const suggestedCompany =
    emailDomain && !companyId
      ? companiesData?.find((c) => c.domain === emailDomain)
      : undefined;

  const createContact = trpc.crm.contacts.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Contact created", variant: "success" });
      setOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setCompanyId(undefined);
      onCreated?.();
    },
    onError: (err) => {
      addToast({
        title: "Failed to create contact",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!name.trim()) return;
    createContact.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      companyId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {suggestedCompany && (
              <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-stone-600">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Company{" "}
                  <span className="font-semibold text-stone-900">{suggestedCompany.name}</span> has
                  this domain — link it?
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 px-2 text-xs"
                  onClick={() => setCompanyId(suggestedCompany.id)}
                >
                  Link
                </Button>
              </div>
            )}
            {companyId && companiesData && (
              <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-xs text-stone-700">
                <span>
                  Linked to:{" "}
                  <span className="font-semibold text-stone-900">
                    {companiesData.find((c) => c.id === companyId)?.name ?? companyId}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setCompanyId(undefined)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="+1 555 000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createContact.isPending}>
              {createContact.isPending ? "Creating…" : "Create Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
