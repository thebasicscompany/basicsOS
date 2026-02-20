"use client";

import { trpc } from "@/lib/trpc";
import { Button, Plus, BookOpen, FileText, EmptyState } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception.
const KnowledgePage = (): JSX.Element => {
  const { data: docs, isLoading } = trpc.knowledge.list.useQuery({ parentId: null });

  const documents = docs ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">Knowledge Base</h1>
        <Button asChild>
          <a href="/knowledge/new">
            <Plus size={14} className="mr-1" /> New Document
          </a>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 animate-pulse"
            >
              <div className="h-8 w-8 rounded-lg bg-stone-100" />
              <div className="h-4 w-48 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          Icon={BookOpen}
          heading="No documents yet"
          description="Create your first document to build your knowledge base."
          action={
            <Button asChild>
              <a href="/knowledge/new">
                <Plus size={14} className="mr-1" /> Create Document
              </a>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={`/knowledge/${doc.id}`}
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileText size={16} />
              </div>
              <span className="font-medium text-stone-900">{doc.title}</span>
              <span className="ml-auto text-xs text-stone-400">Edit</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
