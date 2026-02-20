"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (createMutation.error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-red-500">{createMutation.error.message}</p>
        <button
          onClick={() => router.push("/knowledge")}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          ← Back to Knowledge Base
        </button>
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
