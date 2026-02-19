"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

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
      <h1 className="text-2xl font-bold text-stone-900 mb-6">New Document</h1>
      <form onSubmit={handleCreate} className="space-y-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title..."
          className="w-full text-2xl font-medium border-b-2 border-stone-200 focus:border-primary outline-none py-2 bg-transparent"
        />
        {createMutation.error && (
          <p className="text-sm text-red-500">{createMutation.error.message}</p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Document"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/knowledge")}
            className="rounded-lg border px-6 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewDocumentPage;
