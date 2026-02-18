import { db } from "@basicsos/db";
import { documents } from "@basicsos/db";
import { isNull } from "drizzle-orm";

const KnowledgePage = async (): Promise<JSX.Element> => {
  let docs: Array<{ id: string; title: string; position: number; parentId: string | null }> = [];
  try {
    docs = await db.select({ id: documents.id, title: documents.title, position: documents.position, parentId: documents.parentId })
      .from(documents)
      .where(isNull(documents.parentId))
      .orderBy(documents.position);
  } catch {
    // DB not connected — show empty state
  }

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
      {docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">📚</div>
          <p className="text-gray-500">No documents yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={`/knowledge/${doc.id}`}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 hover:bg-indigo-50 hover:border-indigo-200 transition"
            >
              <span className="text-xl">📄</span>
              <span className="font-medium text-gray-900">{doc.title}</span>
              <span className="ml-auto text-xs text-gray-400">Edit &rarr;</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
