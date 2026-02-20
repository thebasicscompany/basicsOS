"use client";

import { trpc } from "@/lib/trpc";
import { Button, Plus, BookOpen, FileText, EmptyState, PageHeader } from "@basicsos/ui";

// Next.js App Router requires default export — framework exception.
const KnowledgePage = (): JSX.Element => {
  const { data: docs, isLoading } = trpc.knowledge.list.useQuery({ parentId: null });

  const documents = docs ?? [];

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        className="mb-6"
        action={
          <Button asChild>
            <a href="/knowledge/new"><Plus size={14} className="mr-1" /> New Document</a>
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-card animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-stone-200" />
              <div className="h-4 w-48 rounded bg-stone-200" />
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
              <a href="/knowledge/new"><Plus size={14} className="mr-1" /> Create Document</a>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={`/knowledge/${doc.id}`}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-card transition-colors hover:bg-stone-50"
            >
              <span className="text-sm font-medium text-stone-900 line-clamp-1">{doc.title}</span>
              <span className="shrink-0 text-xs text-stone-500">Edit</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
