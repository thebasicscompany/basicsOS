export async function executeWebSearch(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  env: { BASICSOS_API_URL: string },
  apiKey: string,
): Promise<Array<{ title: string; url: string; text?: string }>> {
  const { query, numResults = 5 } = config as {
    query: string;
    numResults?: number;
  };

  const res = await fetch(`${env.BASICSOS_API_URL}/v1/execute/web/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, numResults }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Web search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { results: Array<{ title: string; url: string; text?: string }> };
  return data.results;
}
