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
import { CustomFieldsEditor } from "./CustomFieldsEditor";

interface EditContactDialogProps {
  children: React.ReactNode;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    companyId: string | null;
    customFields?: unknown;
  };
  onUpdated?: () => void;
}

export const EditContactDialog = ({
  children,
  contact,
  onUpdated,
}: EditContactDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(contact.name);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [companyId, setCompanyId] = useState(contact.companyId ?? "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    (contact.customFields as Record<string, unknown>) ?? {},
  );

  const { data: companiesList } = trpc.crm.companies.list.useQuery(undefined, { enabled: open });

  useEffect(() => {
    if (open) {
      setName(contact.name);
      setEmail(contact.email ?? "");
      setPhone(contact.phone ?? "");
      setCompanyId(contact.companyId ?? "");
      setCustomFields((contact.customFields as Record<string, unknown>) ?? {});
    }
  }, [open, contact]);

  const updateContact = trpc.crm.contacts.update.useMutation({
    onSuccess: () => {
      addToast({ title: "Contact updated", variant: "success" });
      setOpen(false);
      onUpdated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to update contact", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!name.trim()) return;
    updateContact.mutate({
      id: contact.id,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      companyId: companyId || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-contact-name">Name</Label>
            <Input id="edit-contact-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-contact-email">Email</Label>
            <Input id="edit-contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-contact-phone">Phone</Label>
            <Input id="edit-contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
          <CustomFieldsEditor entity="contacts" value={customFields} onChange={setCustomFields} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateContact.isPending}>
              {updateContact.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
