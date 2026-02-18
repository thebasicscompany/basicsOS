import { db } from "@basicsos/db";
import { hubLinks } from "@basicsos/db";
import { asc } from "drizzle-orm";

const HubPage = async (): Promise<JSX.Element> => {
  let links: Array<{ id: string; title: string; url: string; icon: string | null; category: string }> = [];
  try {
    links = await db.select({ id: hubLinks.id, title: hubLinks.title, url: hubLinks.url, icon: hubLinks.icon, category: hubLinks.category }).from(hubLinks).orderBy(asc(hubLinks.position));
  } catch { /* DB not connected */ }

  const byCategory = links.reduce<Record<string, typeof links>>((acc, link) => {
    const cat = link.category;
    acc[cat] = [...(acc[cat] ?? []), link];
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Hub</h1>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Add Link</button>
      </div>
      {Object.entries(byCategory).map(([cat, catLinks]) => (
        <div key={cat} className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">{cat}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {catLinks.map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:shadow-md transition">
                <span className="text-2xl">{link.icon ?? "🔗"}</span>
                <span className="font-medium text-gray-900">{link.title}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HubPage;
