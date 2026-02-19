"use client";

import { trpc } from "@/lib/trpc";
import { Books, FileText, ArrowRight } from "@phosphor-icons/react";

// Next.js App Router requires default exports for page segments.
const KnowledgePage = (): JSX.Element => {
  const { data: docs, isLoading } = trpc.knowledge.list.useQuery({ parentId: null });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading Knowledge Base...</div>;
  }

  const documents = docs ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <a
          href="/knowledge/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Document
        </a>
      </div>
      {documents.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="mb-3 flex justify-center">
            <Books size={48} className="text-gray-400" />
          </div>
          <p className="text-gray-500">No documents yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={`/knowledge/${doc.id}`}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 hover:bg-indigo-50 hover:border-indigo-200 transition"
            >
              <FileText size={24} className="text-gray-400" />
              <span className="font-medium text-gray-900">{doc.title}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                Edit <ArrowRight size={14} />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
