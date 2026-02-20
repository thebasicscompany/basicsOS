"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";
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

interface AddLinkDialogProps {
  children: React.ReactNode;
  onCreated?: () => void;
}

export const AddLinkDialog = ({ children, onCreated }: AddLinkDialogProps): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("custom");
  const [icon, setIcon] = useState("🔗");

  const createLink = trpc.hub.createLink.useMutation({
    onSuccess: () => {
      addToast({ title: "Link added", variant: "success" });
      setOpen(false);
      setTitle("");
      setUrl("");
      setCategory("custom");
      setIcon("🔗");
      onCreated?.();
    },
    onError: (err) => {
      addToast({ title: "Failed to add link", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    createLink.mutate({ title: title.trim(), url: url.trim(), category, icon });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Link</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-title">Title</Label>
            <Input
              id="link-title"
              placeholder="e.g. Company Docs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-category">Category</Label>
              <Input
                id="link-category"
                placeholder="e.g. Docs"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-icon">Icon (emoji)</Label>
              <Input
                id="link-icon"
                placeholder="🔗"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLink.isPending}>
              {createLink.isPending ? "Adding…" : "Add Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
