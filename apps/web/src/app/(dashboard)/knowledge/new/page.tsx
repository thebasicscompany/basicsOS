"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Input, PageHeader } from "@basicsos/ui";

// Next.js page — requires default export
const NewDocumentPage = (): JSX.Element => {
  const router = useRouter();
  const [title, setTitle] = useState("");

  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: (doc) => {
      router.push(`/knowledge/${doc.id}`);
    },
  });

  const handleCreate = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim() });
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <PageHeader
        title="New Document"
        backHref="/knowledge"
        backLabel="Knowledge Base"
        className="mb-6"
      />
      <form onSubmit={handleCreate} className="space-y-4">
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title..."
          className="w-full text-2xl font-medium border-0 border-b-2 border-stone-100 focus:border-primary rounded-none py-2 bg-transparent shadow-none"
        />
        {createMutation.error && (
          <p className="text-sm text-destructive">{createMutation.error.message}</p>
        )}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Document"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/knowledge")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewDocumentPage;
