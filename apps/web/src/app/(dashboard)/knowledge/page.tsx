"use client";

import { trpc } from "@/lib/trpc";
import { Button, Plus, BookOpen, EmptyState, PageHeader, Card } from "@basicsos/ui";

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
            <Card key={i} className="flex items-center gap-3 p-4 animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="h-4 w-48 rounded bg-muted" />
            </Card>
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
            <Card key={doc.id} className="p-4 transition-colors hover:bg-accent/50">
              <a href={`/knowledge/${doc.id}`} className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground line-clamp-1">{doc.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Edit</span>
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
