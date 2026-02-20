"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@basicsos/ui";

// Immediately creates a blank document and redirects to the editor.
// Next.js page — requires default export.
const NewDocumentPage = (): JSX.Element => {
  const router = useRouter();

  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: (doc) => {
      router.replace(`/knowledge/${doc.id}`);
    },
  });

  // Fire once on mount
  useEffect(() => {
    createMutation.mutate({ title: "Untitled Document" });
  }, []);

  if (createMutation.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-destructive">{createMutation.error.message}</p>
        <Button variant="ghost" onClick={() => router.push("/knowledge")}>
          ← Back to Knowledge Base
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      <div className="flex items-center gap-2 text-stone-400">
        <div className="h-4 w-4 rounded-full border-2 border-stone-300 border-t-primary animate-spin" />
        <span className="text-sm">Creating document…</span>
      </div>
    </div>
  );
};

export default NewDocumentPage;
