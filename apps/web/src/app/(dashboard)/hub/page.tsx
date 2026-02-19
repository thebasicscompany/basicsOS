"use client";

import { trpc } from "@/lib/trpc";

// Next.js App Router requires default exports for page segments.
const HubPage = (): JSX.Element => {
  const { data: links, isLoading } = trpc.hub.listLinks.useQuery();

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading Hub...</div>;
  }

  const byCategory = (links ?? []).reduce<Record<string, typeof links>>((acc, link) => {
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
            {(catLinks ?? []).map(link => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:shadow-md transition">
                <span className="text-2xl">{link.icon ?? "\uD83D\uDD17"}</span>
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
