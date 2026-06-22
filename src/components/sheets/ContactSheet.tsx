import { TrashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { Textarea } from "@/components/ui/textarea";
import { showError } from "@/lib/show-error";
import {
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useContact,
  type Contact,
  type ContactSummary,
} from "@/hooks/use-contacts";

const EMPTY: Partial<Contact> = {
  firstName: "",
  lastName: "",
  email: "",
  title: "",
  status: "",
  background: "",
};

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | ContactSummary | null;
}

export function ContactSheet({
  open,
  onOpenChange,
  contact,
}: ContactSheetProps) {
  const isEdit = !!contact;
  const [form, setForm] = useState<Partial<Contact>>(EMPTY);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: fullContact } = useContact(contact?.id ?? null);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  useEffect(() => {
    setForm(fullContact ?? contact ?? EMPTY);
  }, [fullContact, contact, open]);

  const set = (field: keyof Contact, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    try {
      if (isEdit && contact) {
        await updateContact.mutateAsync({ id: contact.id, data: form });
      } else {
        await createContact.mutateAsync(form);
      }
      onOpenChange(false);
    } catch (err) {
      showError(err, "Failed to save contact");
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    try {
      await deleteContact.mutateAsync(contact.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch (err) {
      showError(err, "Failed to delete contact");
    }
  };

  const displayName = contact
    ? `${(contact as ContactSummary).firstName ?? ""} ${(contact as ContactSummary).lastName ?? ""}`.trim() ||
      "this contact"
    : "this contact";

  const isPending = createContact.isPending || updateContact.isPending;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[15px]">
              {isEdit ? "Edit Contact" : "New Contact"}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-3 px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[12px]">First Name</Label>
                <Input
                  value={form.firstName ?? ""}
                  onChange={(e) => set("firstName", e.target.value)}
                  className="h-8 text-[13px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Last Name</Label>
                <Input
                  value={form.lastName ?? ""}
                  onChange={(e) => set("lastName", e.target.value)}
                  className="h-8 text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[12px]">Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[12px]">Title / Role</Label>
              <Input
                value={form.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[12px]">Status</Label>
              <Input
                value={form.status ?? ""}
                onChange={(e) => set("status", e.target.value)}
                placeholder="e.g. warm, cold, hot"
                className="h-8 text-[13px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[12px]">Background</Label>
              <Textarea
                value={form.background ?? ""}
                onChange={(e) => set("background", e.target.value)}
                rows={3}
                className="text-[13px]"
              />
            </div>
          </div>

          <SheetFooter className="flex justify-between">
            {isEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[13px] text-destructive hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleteContact.isPending}
              >
                <TrashIcon className="size-3" />
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[13px]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-[13px]"
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {displayName}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All tasks and notes linked to this contact
              will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[13px]"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-[13px]"
              onClick={handleDelete}
              disabled={deleteContact.isPending}
            >
              {deleteContact.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
